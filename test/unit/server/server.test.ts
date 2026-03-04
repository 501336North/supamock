import request from 'supertest';
import { createApp, startServer, printStartupSummary } from '../../../src/server/server.js';
import { MockStore } from '../../../src/store/mock-store.js';
import type { SchemaDefinition, TableInfo, MockRow } from '../../../src/types.js';
import type http from 'node:http';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const usersTable: TableInfo = {
  name: 'users',
  columns: [
    { name: 'id', type: 'uuid', nullable: false, defaultValue: 'gen_random_uuid()', isEnum: false, enumValues: [], isUnique: true },
    { name: 'email', type: 'text', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
    { name: 'name', type: 'text', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
    { name: 'status', type: 'text', nullable: false, defaultValue: "'active'", isEnum: true, enumValues: ['active', 'inactive', 'banned'], isUnique: false },
    { name: 'created_at', type: 'timestamptz', nullable: false, defaultValue: 'now()', isEnum: false, enumValues: [], isUnique: false },
  ],
  primaryKey: ['id'],
  foreignKeys: [],
};

const postsTable: TableInfo = {
  name: 'posts',
  columns: [
    { name: 'id', type: 'integer', nullable: false, defaultValue: "nextval('posts_id_seq')", isEnum: false, enumValues: [], isUnique: true },
    { name: 'title', type: 'text', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
    { name: 'body', type: 'text', nullable: true, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
    { name: 'user_id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
    { name: 'created_at', type: 'timestamptz', nullable: false, defaultValue: 'now()', isEnum: false, enumValues: [], isUnique: false },
  ],
  primaryKey: ['id'],
  foreignKeys: [{ column: 'user_id', referencedTable: 'users', referencedColumn: 'id' }],
};

const fixtureRows: Record<string, MockRow[]> = {
  users: [
    { id: 'user-1', email: 'alice@test.com', name: 'Alice', status: 'active', created_at: '2026-01-15T10:30:00.000Z' },
    { id: 'user-2', email: 'bob@test.com', name: 'Bob', status: 'active', created_at: '2026-01-16T11:00:00.000Z' },
    { id: 'user-3', email: 'carol@test.com', name: 'Carol', status: 'inactive', created_at: '2026-01-17T09:15:00.000Z' },
  ],
  posts: [
    { id: 1, title: 'First Post', body: 'Content 1', user_id: 'user-1', created_at: '2026-02-01T10:00:00.000Z' },
    { id: 2, title: 'Second Post', body: 'Content 2', user_id: 'user-2', created_at: '2026-02-02T11:00:00.000Z' },
  ],
};

function createTestStore(): MockStore {
  const schema: SchemaDefinition = { tables: [usersTable, postsTable] };
  const store = new MockStore(schema);
  store.seedFromData(fixtureRows);
  return store;
}

// ─── Task 15: Server Setup & Startup ────────────────────────────────────────

describe('Server Setup', () => {
  it('should create Express app with JSON body parser and CORS', async () => {
    const store = createTestStore();
    const app = createApp(store);

    // JSON body parser works
    const res = await request(app)
      .post('/users')
      .set('Prefer', 'return=representation')
      .set('Content-Type', 'application/json')
      .send({ email: 'test@test.com', name: 'Test' });

    expect(res.status).toBe(201);

    // CORS headers present on preflight
    const corsRes = await request(app)
      .options('/users')
      .set('Origin', 'http://example.com')
      .set('Access-Control-Request-Method', 'GET');

    expect(corsRes.headers['access-control-allow-origin']).toBeDefined();
  });

  it('should register the PostgREST router', async () => {
    const store = createTestStore();
    const app = createApp(store);

    const res = await request(app).get('/users');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
  });

  it('should print startup summary', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const schema: SchemaDefinition = { tables: [usersTable, postsTable] };

    printStartupSummary(schema, 10);

    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('users');
    expect(output).toContain('posts');

    logSpy.mockRestore();
  });

  it('should bind to 127.0.0.1 by default', async () => {
    const store = createTestStore();
    const app = createApp(store);

    let server: http.Server | undefined;
    try {
      server = await startServer(app, 0);

      const address = server.address();
      expect(address).not.toBeNull();
      expect(typeof address).toBe('object');
      if (typeof address === 'object' && address !== null) {
        expect(address.address).toBe('127.0.0.1');
      }
    } finally {
      if (server) {
        await new Promise<void>((resolve) => {
          server!.close(() => resolve());
        });
      }
    }
  });

  it('should accept a custom host parameter', async () => {
    const store = createTestStore();
    const app = createApp(store);

    let server: http.Server | undefined;
    try {
      server = await startServer(app, 0, '0.0.0.0');

      const address = server.address();
      expect(address).not.toBeNull();
      expect(typeof address).toBe('object');
      if (typeof address === 'object' && address !== null) {
        expect(address.address).toBe('0.0.0.0');
      }
    } finally {
      if (server) {
        await new Promise<void>((resolve) => {
          server!.close(() => resolve());
        });
      }
    }
  });

  it('should return JSON error body for invalid filter operators (not a stack trace)', async () => {
    const store = createTestStore();
    const app = createApp(store);

    // 'banana' is not a valid filter operator, so parseFilters will throw
    const res = await request(app).get('/users?status=banana.active');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      message: 'Internal server error',
      code: 'PGRST500',
      details: null,
      hint: null,
    });
    // Ensure no stack trace is exposed in the response body
    expect(JSON.stringify(res.body)).not.toContain('Error:');
    expect(JSON.stringify(res.body)).not.toContain('at ');
  });

  it('should return JSON error body for invalid filter on PATCH', async () => {
    const store = createTestStore();
    const app = createApp(store);

    const res = await request(app)
      .patch('/users?status=invalid_op.value')
      .send({ name: 'Updated' });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('code', 'PGRST500');
  });

  it('should return JSON error body for invalid filter on DELETE', async () => {
    const store = createTestStore();
    const app = createApp(store);

    const res = await request(app)
      .delete('/users?status=invalid_op.value');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('code', 'PGRST500');
  });

  it('should handle graceful shutdown', async () => {
    const store = createTestStore();
    const app = createApp(store);
    const onSpy = vi.spyOn(process, 'on');

    let server: http.Server | undefined;
    try {
      server = await startServer(app, 0); // port 0 = random available port

      // Verify SIGINT and SIGTERM handlers registered
      const registeredSignals = onSpy.mock.calls.map((call) => call[0]);
      expect(registeredSignals).toContain('SIGINT');
      expect(registeredSignals).toContain('SIGTERM');
    } finally {
      if (server) {
        await new Promise<void>((resolve) => {
          server!.close(() => resolve());
        });
      }
      onSpy.mockRestore();
    }
  });
});
