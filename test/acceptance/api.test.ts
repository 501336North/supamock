/**
 * Acceptance Tests — SupaMock HTTP API Boundary
 *
 * These are the FIRST tests in outside-in TDD. They test at the HTTP
 * boundary using supertest against the Express app. All tests are
 * expected to FAIL because no implementation exists yet (RED phase).
 *
 * Test style: London TDD — test behavior at the system boundary,
 * describe what the user observes, not how it's implemented.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestApp,
  FIXTURE_SCHEMA,
  FIXTURE_ROWS,
} from '../helpers/fixtures.js';

let app: Express;

beforeAll(async () => {
  app = await createTestApp({
    schema: FIXTURE_SCHEMA,
    rows: FIXTURE_ROWS,
  });
});

// ---------------------------------------------------------------------------
// US-004: PostgREST-Compatible API
// ---------------------------------------------------------------------------

/**
 * @behavior Users can list all rows from any table via GET /{table}
 * @user-story US-004 PostgREST-Compatible API
 */
describe('US-004: PostgREST-Compatible API', () => {

  // -------------------------------------------------------------------------
  // AC-004.1 through AC-004.10: Read endpoints
  // -------------------------------------------------------------------------

  /**
   * @behavior GET /{table} returns all rows as a JSON array
   * @user-story US-004
   */
  describe('GET /{table} — list all rows', () => {
    it('should return 200 with all rows as a JSON array', async () => {
      // Given: a running SupaMock server with fixture data for the "users" table
      // When: a client sends GET /users
      const response = await request(app).get('/users');

      // Then: the server responds with 200 and a JSON array of all user rows
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(FIXTURE_ROWS['users']!.length);

      // Then: each row has the expected columns from the users table
      const firstRow = response.body[0];
      expect(firstRow).toHaveProperty('id');
      expect(firstRow).toHaveProperty('email');
      expect(firstRow).toHaveProperty('name');
      expect(firstRow).toHaveProperty('status');
      expect(firstRow).toHaveProperty('created_at');
    });
  });

  /**
   * @behavior GET /{table}?select=col1,col2 returns only selected columns
   * @user-story US-004
   */
  describe('GET /{table}?select=col1,col2 — column selection', () => {
    it('should return only the requested columns', async () => {
      // Given: a running SupaMock server with fixture users
      // When: a client sends GET /users?select=id,email
      const response = await request(app).get('/users?select=id,email');

      // Then: the server responds with 200
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Then: each row contains ONLY id and email (no other columns)
      for (const row of response.body) {
        const keys = Object.keys(row);
        expect(keys).toEqual(expect.arrayContaining(['id', 'email']));
        expect(keys).toHaveLength(2);
        expect(row).not.toHaveProperty('name');
        expect(row).not.toHaveProperty('status');
        expect(row).not.toHaveProperty('created_at');
      }
    });
  });

  /**
   * @behavior GET /{table}?column=eq.value filters rows by equality
   * @user-story US-004
   */
  describe('GET /{table}?column=eq.value — equality filtering', () => {
    it('should return only rows matching the filter', async () => {
      // Given: fixture users with statuses: active, active, inactive, active, banned
      // When: a client sends GET /users?status=eq.active
      const response = await request(app).get('/users?status=eq.active');

      // Then: the server responds with 200 and only active users
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      const activeUsers = FIXTURE_ROWS['users']!.filter(
        (u) => u['status'] === 'active',
      );
      expect(response.body).toHaveLength(activeUsers.length);

      // Then: every returned row has status "active"
      for (const row of response.body) {
        expect(row.status).toBe('active');
      }
    });
  });

  /**
   * @behavior GET /{table}?order=col.desc orders rows by column descending
   * @user-story US-004
   */
  describe('GET /{table}?order=col.desc — ordering', () => {
    it('should return rows ordered by the specified column and direction', async () => {
      // Given: fixture users with different created_at timestamps
      // When: a client sends GET /users?order=created_at.desc
      const response = await request(app).get('/users?order=created_at.desc');

      // Then: the server responds with 200
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(1);

      // Then: rows are in descending order of created_at
      for (let i = 0; i < response.body.length - 1; i++) {
        const current = new Date(response.body[i].created_at).getTime();
        const next = new Date(response.body[i + 1].created_at).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });
  });

  /**
   * @behavior GET /{table}?limit=N&offset=M paginates the result set
   * @user-story US-004
   */
  describe('GET /{table}?limit=N&offset=M — pagination', () => {
    it('should return the correct slice of rows', async () => {
      // Given: 10 fixture posts
      // When: a client sends GET /posts?limit=5&offset=3
      const response = await request(app).get('/posts?limit=5&offset=3');

      // Then: the server responds with 200
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Then: exactly 5 rows are returned (posts at indices 3..7)
      expect(response.body).toHaveLength(5);

      // Then: the first returned row corresponds to the 4th fixture post (offset=3)
      expect(response.body[0].id).toBe(FIXTURE_ROWS['posts']![3]!['id']);
    });
  });

  /**
   * @behavior GET /{table}?select=*,related(*) embeds related rows via FK
   * @user-story US-004
   */
  describe('GET /{table}?select=*,related(*) — relation embedding', () => {
    it('should embed the related table rows as nested objects', async () => {
      // Given: fixture posts with FK user_id -> users.id
      // When: a client sends GET /posts?select=*,users(*)
      const response = await request(app).get('/posts?select=*,users(*)');

      // Then: the server responds with 200 and each post has a nested "users" object
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Then: the embedded user object has the expected columns
      const firstPost = response.body[0];
      expect(firstPost).toHaveProperty('users');
      expect(firstPost.users).toHaveProperty('id');
      expect(firstPost.users).toHaveProperty('email');
      expect(firstPost.users).toHaveProperty('name');

      // Then: the embedded user matches the FK reference
      const expectedUserId = FIXTURE_ROWS['posts']![0]!['user_id'];
      expect(firstPost.users.id).toBe(expectedUserId);
    });
  });

  /**
   * @behavior Prefer: count=exact includes Content-Range header with total count
   * @user-story US-004
   */
  describe('GET /{table} with Prefer: count=exact — Content-Range header', () => {
    it('should return Content-Range header with total row count', async () => {
      // Given: 5 fixture users
      // When: a client sends GET /users with Prefer: count=exact header
      const response = await request(app)
        .get('/users')
        .set('Prefer', 'count=exact');

      // Then: the server responds with 200
      expect(response.status).toBe(200);

      // Then: Content-Range header is present with format "start-end/total"
      const contentRange = response.headers['content-range'];
      expect(contentRange).toBeDefined();
      expect(contentRange).toMatch(/^\d+-\d+\/\d+$/);

      // Then: the total count matches the fixture row count
      const total = parseInt(contentRange.split('/')[1], 10);
      expect(total).toBe(FIXTURE_ROWS['users']!.length);
    });
  });

  // -------------------------------------------------------------------------
  // AC-004.11 through AC-004.13: Write endpoints (fake, no mutation)
  // -------------------------------------------------------------------------

  /**
   * @behavior POST /{table} returns 201 with echoed body and generated defaults
   * @user-story US-004
   */
  describe('POST /{table} — fake create', () => {
    it('should return 201 with the echoed body plus generated defaults', async () => {
      // Given: a running SupaMock server
      // When: a client sends POST /users with a JSON body
      const payload = { email: 'newuser@example.com', name: 'New User' };
      const response = await request(app)
        .post('/users')
        .set('Content-Type', 'application/json')
        .set('Prefer', 'return=representation')
        .send(payload);

      // Then: the server responds with 201 Created
      expect(response.status).toBe(201);

      // Then: the response body is a JSON array (PostgREST convention)
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);

      // Then: the returned row echoes the sent fields
      const created = response.body[0];
      expect(created.email).toBe(payload.email);
      expect(created.name).toBe(payload.name);

      // Then: generated defaults are present (id, created_at)
      expect(created).toHaveProperty('id');
      expect(created.id).toBeTruthy();
      expect(created).toHaveProperty('created_at');
    });
  });

  /**
   * @behavior PATCH /{table}?id=eq.{value} returns 200 with patched row
   * @user-story US-004
   */
  describe('PATCH /{table}?filter — fake update', () => {
    it('should return 200 with the patched row', async () => {
      // Given: a fixture user with known id
      const targetUserId = FIXTURE_ROWS['users']![0]!['id'];

      // When: a client sends PATCH /users?id=eq.{id} with updated fields
      const patch = { name: 'Alice Updated' };
      const response = await request(app)
        .patch(`/users?id=eq.${targetUserId}`)
        .set('Content-Type', 'application/json')
        .set('Prefer', 'return=representation')
        .send(patch);

      // Then: the server responds with 200
      expect(response.status).toBe(200);

      // Then: the response is a JSON array with the patched row
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Then: the patched field is updated
      const patched = response.body[0];
      expect(patched.name).toBe('Alice Updated');

      // Then: the other fields are preserved from the original row
      expect(patched.id).toBe(targetUserId);
      expect(patched.email).toBe('alice@example.com');
    });
  });

  /**
   * @behavior DELETE /{table}?id=eq.{value} returns 200
   * @user-story US-004
   */
  describe('DELETE /{table}?filter — fake delete', () => {
    it('should return 200', async () => {
      // Given: a fixture user with known id
      const targetUserId = FIXTURE_ROWS['users']![0]!['id'];

      // When: a client sends DELETE /users?id=eq.{id}
      const response = await request(app)
        .delete(`/users?id=eq.${targetUserId}`);

      // Then: the server responds with 200
      expect(response.status).toBe(200);

      // Then: the response body is valid JSON (empty array or deleted rows)
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  // -------------------------------------------------------------------------
  // AC-006.4: Error — unknown table
  // -------------------------------------------------------------------------

  /**
   * @behavior GET /nonexistent returns 404 with PostgREST error body
   * @user-story US-004
   */
  describe('GET /nonexistent — unknown table', () => {
    it('should return 404 with a PostgREST-shaped error body', async () => {
      // Given: no table named "nonexistent" in the fixture schema
      // When: a client sends GET /nonexistent
      const response = await request(app).get('/nonexistent');

      // Then: the server responds with 404
      expect(response.status).toBe(404);

      // Then: the body follows PostgREST error format
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('code', 'PGRST200');
      expect(response.body).toHaveProperty('details');
      expect(response.body).toHaveProperty('hint');

      // Then: the error message mentions the missing table
      expect(response.body.message).toContain('nonexistent');
    });
  });
});

// ---------------------------------------------------------------------------
// US-005: CLI Experience (server boundary)
// ---------------------------------------------------------------------------

/**
 * @behavior The mock server starts and responds on the configured port
 * @user-story US-005 CLI Experience
 */
describe('US-005: CLI Experience — server responds', () => {
  it('should respond to HTTP requests on the app instance', async () => {
    // Given: a SupaMock app created with fixture data
    // When: a client sends any GET request to a known table
    const response = await request(app).get('/users');

    // Then: the server responds (status is not connection-refused)
    expect(response.status).toBeDefined();
    expect(response.status).not.toBe(500);

    // Then: the response is valid JSON
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });
});
