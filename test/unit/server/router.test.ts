import express from 'express';
import request from 'supertest';
import { createRouter } from '../../../src/server/router.js';
import { MockStore } from '../../../src/store/mock-store.js';
import type { SchemaDefinition, TableInfo, MockRow } from '../../../src/types.js';

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

const commentsTable: TableInfo = {
  name: 'comments',
  columns: [
    { name: 'id', type: 'integer', nullable: false, defaultValue: "nextval('comments_id_seq')", isEnum: false, enumValues: [], isUnique: true },
    { name: 'body', type: 'text', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
    { name: 'post_id', type: 'integer', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
    { name: 'user_id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
  ],
  primaryKey: ['id'],
  foreignKeys: [
    { column: 'post_id', referencedTable: 'posts', referencedColumn: 'id' },
    { column: 'user_id', referencedTable: 'users', referencedColumn: 'id' },
  ],
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
  comments: [
    { id: 1, body: 'Nice post!', post_id: 1, user_id: 'user-2' },
    { id: 2, body: 'Thanks!', post_id: 1, user_id: 'user-1' },
  ],
};

function createTestApp(): express.Express {
  const schema: SchemaDefinition = { tables: [usersTable, postsTable, commentsTable] };
  const store = new MockStore(schema);
  store.seedFromData(fixtureRows);
  const app = express();
  app.use(express.json());
  app.use('/', createRouter(store));
  return app;
}

// ─── Task 13: GET Endpoints ─────────────────────────────────────────────────

describe('PostgREST Router — GET Endpoints', () => {
  it('GET /users should return all rows as JSON array', async () => {
    const app = createTestApp();
    const res = await request(app).get('/users');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
  });

  it('GET /users?select=id,email should return only selected columns', async () => {
    const app = createTestApp();
    const res = await request(app).get('/users?select=id,email');

    expect(res.status).toBe(200);
    for (const row of res.body as Record<string, unknown>[]) {
      expect(Object.keys(row)).toEqual(['id', 'email']);
    }
  });

  it('GET /users?status=eq.active should return filtered rows', async () => {
    const app = createTestApp();
    const res = await request(app).get('/users?status=eq.active');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    for (const row of res.body as Record<string, unknown>[]) {
      expect(row['status']).toBe('active');
    }
  });

  it('GET /posts?order=id.desc&limit=1 should return ordered, limited rows', async () => {
    const app = createTestApp();
    const res = await request(app).get('/posts?order=id.desc&limit=1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect((res.body as Record<string, unknown>[])[0]!['id']).toBe(2);
  });

  it('GET /nonexistent should return 404 with PostgREST error body', async () => {
    const app = createTestApp();
    const res = await request(app).get('/nonexistent');

    expect(res.status).toBe(404);
    const body = res.body as Record<string, unknown>;
    expect(body['code']).toBe('PGRST200');
    expect(body['message']).toBeDefined();
  });

  it('GET /users?select=nonexistent should return 400', async () => {
    const app = createTestApp();
    const res = await request(app).get('/users?select=nonexistent');

    expect(res.status).toBe(400);
    const body = res.body as Record<string, unknown>;
    expect(body['code']).toBe('PGRST102');
    expect(body['hint']).toBeDefined();
  });

  it('should include X-SupaMock: true header', async () => {
    const app = createTestApp();
    const res = await request(app).get('/users');

    expect(res.headers['x-supamock']).toBe('true');
  });
});

// ─── Task 14: Write Endpoints (POST/PATCH/DELETE) ───────────────────────────

describe('PostgREST Router — Write Endpoints', () => {
  it('POST /users should return 201 with echoed body + generated defaults', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/users')
      .set('Prefer', 'return=representation')
      .send({ email: 'dave@test.com', name: 'Dave' });

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body)).toBe(true);
    const row = (res.body as Record<string, unknown>[])[0]!;
    expect(row['email']).toBe('dave@test.com');
    expect(row['name']).toBe('Dave');
    // Should have generated default fields
    expect(row['id']).toBeDefined();
    expect(row['created_at']).toBeDefined();
  });

  it('PATCH /users?id=eq.user-1 should return 200 with patched row', async () => {
    const app = createTestApp();
    const res = await request(app)
      .patch('/users?id=eq.user-1')
      .set('Prefer', 'return=representation')
      .send({ name: 'Alice Updated' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const row = (res.body as Record<string, unknown>[])[0]!;
    expect(row['name']).toBe('Alice Updated');
    // Original fields should be preserved
    expect(row['email']).toBe('alice@test.com');
    expect(row['id']).toBe('user-1');
  });

  it('DELETE /users?id=eq.user-1 should return 200', async () => {
    const app = createTestApp();
    const res = await request(app)
      .delete('/users?id=eq.user-1')
      .set('Prefer', 'return=representation');

    expect(res.status).toBe(200);
  });

  it('POST should not mutate the store', async () => {
    const app = createTestApp();

    // POST a new user
    await request(app)
      .post('/users')
      .set('Prefer', 'return=representation')
      .send({ email: 'new@test.com', name: 'New' });

    // GET should still return original 3 users
    const res = await request(app).get('/users');
    expect(res.body).toHaveLength(3);
  });

  it('should respect Prefer: return=representation vs return=minimal', async () => {
    const app = createTestApp();

    // return=representation should include body
    const repRes = await request(app)
      .post('/users')
      .set('Prefer', 'return=representation')
      .send({ email: 'rep@test.com', name: 'Rep' });

    expect(repRes.status).toBe(201);
    expect(Array.isArray(repRes.body)).toBe(true);
    expect((repRes.body as Record<string, unknown>[]).length).toBeGreaterThan(0);

    // return=minimal should return empty body
    const minRes = await request(app)
      .post('/users')
      .set('Prefer', 'return=minimal')
      .send({ email: 'min@test.com', name: 'Min' });

    expect(minRes.status).toBe(201);
    // Body should be empty or empty string
    const body = minRes.body as unknown;
    const isEmpty = body === '' || body === undefined || body === null ||
      (typeof body === 'object' && body !== null && Object.keys(body).length === 0);
    expect(isEmpty).toBe(true);
  });
});

// ─── Task 18: Per-Request Seed Override ──────────────────────────────────────

describe('PostgREST Router — Seed Override', () => {
  it('GET /users?seed=random should return different data than seeded default', async () => {
    const app = createTestApp();

    const defaultRes = await request(app).get('/users');
    const randomRes = await request(app).get('/users?seed=random');

    expect(randomRes.status).toBe(200);
    expect(Array.isArray(randomRes.body)).toBe(true);
    // The random-seeded data should differ from the fixture data
    const defaultEmails = (defaultRes.body as Record<string, unknown>[]).map((r) => r['email']);
    const randomEmails = (randomRes.body as Record<string, unknown>[]).map((r) => r['email']);
    expect(randomEmails).not.toEqual(defaultEmails);
  });

  it('GET /users (without seed param) should return deterministic data', async () => {
    const app = createTestApp();

    const res1 = await request(app).get('/users');
    const res2 = await request(app).get('/users');

    expect(res1.body).toEqual(res2.body);
  });
});
