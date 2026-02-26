import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import cors from 'cors';
import request from 'supertest';
import { createRouter } from '../../src/router.js';
import type { ColumnMetadata, TableMetadata, ServerConfig } from '../../src/types.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeColumn(overrides: Partial<ColumnMetadata> = {}): ColumnMetadata {
  return {
    name: 'test_col',
    dataType: 'text',
    isNullable: false,
    isUnique: false,
    isPrimaryKey: false,
    foreignKey: null,
    checkConstraint: null,
    enumValues: null,
    comment: null,
    columnDefault: null,
    ...overrides,
  };
}

function makeTable(name: string, columns: Partial<ColumnMetadata>[]): TableMetadata {
  return {
    name,
    columns: columns.map((c) => makeColumn(c)),
  };
}

// ─── Test fixtures ──────────────────────────────────────────────────────────

const usersTable = makeTable('users', [
  { name: 'id', dataType: 'serial', isPrimaryKey: true },
  { name: 'email', dataType: 'varchar', isUnique: true, isNullable: false },
  { name: 'name', dataType: 'varchar' },
]);

const ordersTable = makeTable('orders', [
  { name: 'id', dataType: 'serial', isPrimaryKey: true },
  {
    name: 'user_id',
    dataType: 'integer',
    isNullable: false,
    foreignKey: { referencedTable: 'users', referencedColumn: 'id' },
  },
  { name: 'total', dataType: 'numeric' },
  { name: 'status', dataType: 'varchar', checkConstraint: ['pending', 'shipped', 'delivered'] },
]);

const tables: TableMetadata[] = [usersTable, ordersTable];
const sortOrder = ['users', 'orders'];

const config: ServerConfig = {
  dbUrl: 'postgresql://localhost/test',
  port: 3000,
  defaultCount: 10,
  format: 'rest',
};

function createTestApp(testTables?: TableMetadata[], testSortOrder?: string[], testConfig?: ServerConfig): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  const router = createRouter(
    testTables ?? tables,
    testSortOrder ?? sortOrder,
    testConfig ?? config,
  );
  app.use('/mock', router);
  return app;
}

// ─── Task 11: Router ────────────────────────────────────────────────────────

describe('Task 11 — Router', () => {
  // 1. should mount GET /mock/:table for each discovered table
  it('should mount GET /mock/:table for each discovered table', async () => {
    const app = createTestApp();

    const res = await request(app).get('/mock/users');
    expect(res.status).toBe(200);
  });

  // 2. should return 404 for undiscovered table
  it('should return 404 for undiscovered table', async () => {
    const app = createTestApp();

    const res = await request(app).get('/mock/nonexistent');
    expect(res.status).toBe(404);
  });

  // 3. should return _status endpoint with table list
  it('should return _status endpoint with table list', async () => {
    const app = createTestApp();

    const res = await request(app).get('/mock/_status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tables');
    expect(res.body.tables).toContain('users');
    expect(res.body.tables).toContain('orders');
  });

  // 4. should skip table named _status with warning
  it('should skip table named _status with warning', async () => {
    const statusTable = makeTable('_status', [
      { name: 'id', dataType: 'serial', isPrimaryKey: true },
      { name: 'label', dataType: 'text' },
    ]);

    const tablesWithStatus = [...tables, statusTable];
    const sortWithStatus = [...sortOrder, '_status'];

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const app = createTestApp(tablesWithStatus, sortWithStatus);

    // The _status route should still work as the reserved endpoint
    const res = await request(app).get('/mock/_status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tables');
    // The table list should include _status since it exists in metadata,
    // but the dynamic data route for _status should not be mounted
    expect(res.body.tables).toContain('users');
    expect(res.body.tables).toContain('orders');

    // A warning should have been logged
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('_status'),
    );

    warnSpy.mockRestore();
  });

  // 5. should return correct record count based on ?limit
  it('should return correct record count based on ?limit', async () => {
    const app = createTestApp();

    const res = await request(app).get('/mock/users?limit=3');
    expect(res.status).toBe(200);

    // In REST mode, data is in res.body.data
    const records = res.body.data;
    expect(records).toHaveLength(3);
  });

  // 6. should return 400 for ?limit exceeding 1000
  it('should return 400 for ?limit exceeding 1000', async () => {
    const app = createTestApp();

    const res = await request(app).get('/mock/users?limit=1001');
    expect(res.status).toBe(400);
  });

  // 7. should return single record with injected ID for GET /mock/:table/:id
  it('should return single record with injected ID for GET /mock/:table/:id', async () => {
    const app = createTestApp();

    const res = await request(app).get('/mock/users/42');
    expect(res.status).toBe(200);

    // In REST mode, data is in res.body.data (single record, but still formatted)
    const data = res.body.data;
    // Could be a single record or array of one
    const record = Array.isArray(data) ? data[0] : data;
    expect(record.id).toBe(42);
  });

  // 8. should return 400 for ID type mismatch (string for integer PK)
  it('should return 400 for ID type mismatch (string for integer PK)', async () => {
    const app = createTestApp();

    const res = await request(app).get('/mock/users/not-a-number');
    expect(res.status).toBe(400);
  });

  // 9. should ignore ?offset without ?seed
  it('should ignore ?offset without ?seed', async () => {
    const app = createTestApp();

    const res = await request(app).get('/mock/users?offset=5');
    expect(res.status).toBe(200);
  });

  // 10. should include CORS headers
  it('should include CORS headers', async () => {
    const app = createTestApp();

    const res = await request(app).get('/mock/users');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  // 11. should produce deterministic data with ?seed
  it('should produce deterministic data with ?seed', async () => {
    const app = createTestApp();

    const res1 = await request(app).get('/mock/users?seed=abc');
    const res2 = await request(app).get('/mock/users?seed=abc');

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body).toEqual(res2.body);
  });
});
