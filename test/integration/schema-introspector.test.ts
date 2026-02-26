import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { createReadOnlyPool, introspect } from '../../src/schema-introspector.js';
import type { TableMetadata, ColumnMetadata } from '../../src/types.js';

const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  'postgresql://ai_dev:ai_dev_secret_2024@localhost:5432/ai_dev_shop';

/**
 * Attempt a quick connection to decide whether to skip the entire suite.
 * Evaluated once at module load so `describe.runIf` can gate on it.
 */
async function canConnectToPostgres(): Promise<boolean> {
  const pool = new pg.Pool({ connectionString: TEST_DB_URL, connectionTimeoutMillis: 5000 });
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
}

const pgAvailable = await canConnectToPostgres();

const SETUP_SQL = `
CREATE TABLE IF NOT EXISTS sm_test_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sm_test_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) CHECK (status IN ('active', 'archived'))
);

CREATE TABLE IF NOT EXISTS sm_test_orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES sm_test_users(id),
  total NUMERIC(10,2),
  status VARCHAR(20) CHECK (status IN ('pending', 'shipped', 'delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sm_test_order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES sm_test_orders(id),
  product_id UUID NOT NULL REFERENCES sm_test_products(id),
  quantity INTEGER NOT NULL
);

COMMENT ON COLUMN sm_test_users.email IS 'faker:internet.email';
`;

const TEARDOWN_SQL = `
DROP TABLE IF EXISTS sm_test_order_items CASCADE;
DROP TABLE IF EXISTS sm_test_orders CASCADE;
DROP TABLE IF EXISTS sm_test_products CASCADE;
DROP TABLE IF EXISTS sm_test_users CASCADE;
`;

describe.runIf(pgAvailable)('SchemaIntrospector (integration)', () => {
  let setupPool: pg.Pool;
  let readOnlyPool: pg.Pool;
  let tables: TableMetadata[];

  beforeAll(async () => {
    // Setup pool (read-write) for creating and tearing down test tables
    setupPool = new pg.Pool({ connectionString: TEST_DB_URL });
    await setupPool.query(TEARDOWN_SQL); // clean slate
    await setupPool.query(SETUP_SQL);

    // Read-only pool via our module
    readOnlyPool = createReadOnlyPool(TEST_DB_URL);

    // Run introspection
    const allTables = await introspect(readOnlyPool);

    // Filter to only sm_test_* tables so we don't conflict with other data
    tables = allTables.filter((t) => t.name.startsWith('sm_test_'));
  });

  afterAll(async () => {
    if (setupPool) {
      await setupPool.query(TEARDOWN_SQL);
      await setupPool.end();
    }
    if (readOnlyPool) {
      await readOnlyPool.end();
    }
  });

  // ---- helpers ----
  function findTable(name: string): TableMetadata {
    const t = tables.find((tbl) => tbl.name === name);
    if (!t) throw new Error(`Table "${name}" not found. Available: ${tables.map((tbl) => tbl.name).join(', ')}`);
    return t;
  }

  function findColumn(tableName: string, columnName: string): ColumnMetadata {
    const table = findTable(tableName);
    const col = table.columns.find((c) => c.name === columnName);
    if (!col) {
      throw new Error(
        `Column "${columnName}" not found in "${tableName}". Available: ${table.columns.map((c) => c.name).join(', ')}`,
      );
    }
    return col;
  }

  // ---- tests ----

  it('should discover tables in public schema', () => {
    const names = tables.map((t) => t.name).sort();
    expect(names).toEqual(
      expect.arrayContaining([
        'sm_test_users',
        'sm_test_products',
        'sm_test_orders',
        'sm_test_order_items',
      ]),
    );
    expect(names.length).toBeGreaterThanOrEqual(4);
  });

  it('should extract column names and data types', () => {
    const col = findColumn('sm_test_users', 'email');
    expect(col.name).toBe('email');
    // information_schema reports varchar as 'character varying'
    expect(col.dataType).toMatch(/character varying|varchar/i);
  });

  it('should identify NOT NULL constraints', () => {
    const id = findColumn('sm_test_users', 'id');
    expect(id.isNullable).toBe(false);

    const bio = findColumn('sm_test_users', 'bio');
    expect(bio.isNullable).toBe(true);
  });

  it('should identify primary keys', () => {
    const id = findColumn('sm_test_users', 'id');
    expect(id.isPrimaryKey).toBe(true);

    const email = findColumn('sm_test_users', 'email');
    expect(email.isPrimaryKey).toBe(false);
  });

  it('should identify foreign keys with referenced table and column', () => {
    const userId = findColumn('sm_test_orders', 'user_id');
    expect(userId.foreignKey).not.toBeNull();
    expect(userId.foreignKey?.referencedTable).toBe('sm_test_users');
    expect(userId.foreignKey?.referencedColumn).toBe('id');
  });

  it('should extract CHECK IN constraints as enum values', () => {
    const status = findColumn('sm_test_orders', 'status');
    expect(status.checkConstraint).not.toBeNull();
    expect(status.checkConstraint?.sort()).toEqual(
      ['delivered', 'pending', 'shipped'].sort(),
    );
  });

  it('should extract UNIQUE constraints', () => {
    const email = findColumn('sm_test_users', 'email');
    expect(email.isUnique).toBe(true);

    const firstName = findColumn('sm_test_users', 'first_name');
    expect(firstName.isUnique).toBe(false);
  });

  it('should extract column comments (faker directives)', () => {
    const email = findColumn('sm_test_users', 'email');
    expect(email.comment).toBe('faker:internet.email');
  });

  it('should enforce read-only session', async () => {
    const client = await readOnlyPool.connect();
    try {
      await expect(
        client.query('INSERT INTO sm_test_users (email) VALUES ($1)', ['readonly@test.com']),
      ).rejects.toThrow(/read-only|cannot execute/i);
    } finally {
      client.release();
    }
  });
});
