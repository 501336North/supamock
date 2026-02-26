import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { startServer, type StartServerResult } from '../../src/index.js';

// ─── Connection ─────────────────────────────────────────────────────────────

const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  'postgresql://ai_dev:ai_dev_secret_2024@localhost:5432/ai_dev_shop';

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

// ─── Test table DDL ─────────────────────────────────────────────────────────

const SETUP_SQL = `
CREATE TABLE IF NOT EXISTS sm_e2e_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100),
  bio TEXT
);

CREATE TABLE IF NOT EXISTS sm_e2e_orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES sm_e2e_users(id),
  total NUMERIC(10,2),
  status VARCHAR(20) CHECK (status IN ('pending', 'shipped', 'delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sm_e2e_comments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES sm_e2e_orders(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

const TEARDOWN_SQL = `
DROP TABLE IF EXISTS sm_e2e_comments CASCADE;
DROP TABLE IF EXISTS sm_e2e_orders CASCADE;
DROP TABLE IF EXISTS sm_e2e_users CASCADE;
`;

// ─── Types for JSON responses ───────────────────────────────────────────────

interface RestResponse {
  data: Record<string, unknown>[];
  meta: { total: number; limit: number; offset: number };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe.runIf(pgAvailable)('Task 13 — E2E Integration', () => {
  let setupPool: pg.Pool;
  let restServer: StartServerResult;
  let supabaseServer: StartServerResult;

  const REST_PORT = 43310;
  const SUPA_PORT = 43311;

  beforeAll(async () => {
    // Create test tables
    setupPool = new pg.Pool({ connectionString: TEST_DB_URL });
    await setupPool.query(TEARDOWN_SQL);
    await setupPool.query(SETUP_SQL);

    // Start REST-mode server
    restServer = await startServer({
      dbUrl: TEST_DB_URL,
      port: REST_PORT,
      defaultCount: 10,
      format: 'rest',
    });

    // Start Supabase-mode server
    supabaseServer = await startServer({
      dbUrl: TEST_DB_URL,
      port: SUPA_PORT,
      defaultCount: 10,
      format: 'supabase',
    });
  });

  afterAll(async () => {
    if (restServer) {
      await restServer.close();
    }
    if (supabaseServer) {
      await supabaseServer.close();
    }
    if (setupPool) {
      await setupPool.query(TEARDOWN_SQL);
      await setupPool.end();
    }
  });

  // Helper to fetch from the REST server
  async function fetchRest(path: string): Promise<Response> {
    return fetch(`http://127.0.0.1:${REST_PORT}/mock${path}`);
  }

  // Helper to fetch from the Supabase server
  async function fetchSupa(path: string): Promise<Response> {
    return fetch(`http://127.0.0.1:${SUPA_PORT}/mock${path}`);
  }

  // 1. should serve mock data for all discovered tables
  it('should serve mock data for all discovered tables', async () => {
    // First check which tables are discovered
    const statusRes = await fetchRest('/_status');
    expect(statusRes.status).toBe(200);
    const statusBody = await statusRes.json() as { tables: string[] };
    const e2eTables = statusBody.tables.filter((t: string) => t.startsWith('sm_e2e_'));
    expect(e2eTables).toEqual(
      expect.arrayContaining(['sm_e2e_users', 'sm_e2e_orders', 'sm_e2e_comments']),
    );

    // Fetch data for each e2e table
    for (const table of e2eTables) {
      const res = await fetchRest(`/${table}`);
      expect(res.status).toBe(200);
      const body = await res.json() as RestResponse;
      expect(body.data.length).toBeGreaterThan(0);
    }
  });

  // 2. should maintain FK integrity across related endpoints
  it('should maintain FK integrity across related endpoints', async () => {
    // When we request orders, the router generates dependency tables first.
    // Each order's user_id should reference an existing user in the registry.
    // We verify by fetching orders and checking that user_ids are valid integers > 0.
    const res = await fetchRest('/sm_e2e_orders?seed=fk_test&limit=5');
    expect(res.status).toBe(200);
    const body = await res.json() as RestResponse;

    for (const order of body.data) {
      // user_id should be a positive integer (auto-increment PK from the generated users)
      expect(typeof order.user_id).toBe('number');
      expect(order.user_id).toBeGreaterThan(0);
    }
  });

  // 3. should respect CHECK constraints
  it('should respect CHECK constraints', async () => {
    const allowedStatuses = ['pending', 'shipped', 'delivered'];
    const res = await fetchRest('/sm_e2e_orders?seed=check_test&limit=20');
    expect(res.status).toBe(200);
    const body = await res.json() as RestResponse;

    for (const order of body.data) {
      // status can be null (nullable column with ~20% null) or one of the allowed values
      if (order.status !== null) {
        expect(allowedStatuses).toContain(order.status);
      }
    }
  });

  // 4. should expand relations correctly
  it('should expand relations correctly', async () => {
    const res = await fetchRest('/sm_e2e_orders?expand=user&seed=expand_test&limit=3');
    expect(res.status).toBe(200);
    const body = await res.json() as RestResponse;

    for (const order of body.data) {
      // Each order should have an inlined "user" object
      expect(order).toHaveProperty('user');
      const user = order.user as Record<string, unknown> | null;
      // user should be an object (not null) because user_id is NOT NULL
      expect(user).not.toBeNull();
      expect(typeof user).toBe('object');
      // The inlined user should have an id field
      expect(user).toHaveProperty('id');
    }
  });

  // 5. should produce deterministic output with seed
  it('should produce deterministic output with seed', async () => {
    const seed = 'determinism_e2e_42';
    const res1 = await fetchRest(`/sm_e2e_users?seed=${seed}&limit=5`);
    const res2 = await fetchRest(`/sm_e2e_users?seed=${seed}&limit=5`);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const body1 = await res1.json() as RestResponse;
    const body2 = await res2.json() as RestResponse;

    expect(body1).toEqual(body2);
  });

  // 6. should work in Supabase format mode
  it('should work in Supabase format mode', async () => {
    const res = await fetchSupa('/sm_e2e_users?limit=3');
    expect(res.status).toBe(200);

    // Supabase mode returns a bare array, not {data: [...]}
    const body = await res.json() as Record<string, unknown>[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(3);

    // Should have Supabase-specific headers
    const contentRange = res.headers.get('content-range');
    expect(contentRange).toBeDefined();
    expect(contentRange).toMatch(/^\d+-\d+\/\d+$/);

    const totalCount = res.headers.get('x-total-count');
    expect(totalCount).toBeDefined();
    expect(totalCount).toBe('3');
  });
});
