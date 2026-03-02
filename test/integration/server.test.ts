/**
 * Integration Tests -- Full Express Server Stack
 *
 * These tests exercise the full server stack from HTTP request to response,
 * validating that the router, query parser, response formatter, and store
 * all work together correctly through the Express app.
 *
 * Uses supertest against the Express app created by createTestApp.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp, FIXTURE_SCHEMA, FIXTURE_ROWS } from '../helpers/fixtures.js';

let app: Express;

beforeAll(async () => {
  app = await createTestApp();
});

describe('full server', () => {
  /**
   * @behavior GET /users returns all seeded users with correct schema shape
   * @business-rule Tables serve all seeded rows with expected columns
   */
  it('should respond to GET /users with generated data', async () => {
    const response = await request(app).get('/users');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(FIXTURE_ROWS['users']!.length);

    // Verify schema shape: each row should have columns matching the users table
    const usersTable = FIXTURE_SCHEMA.tables.find((t) => t.name === 'users');
    const columnNames = usersTable!.columns.map((c) => c.name);

    for (const row of response.body) {
      for (const col of columnNames) {
        expect(row).toHaveProperty(col);
      }
    }
  });

  /**
   * @behavior GET /users?status=eq.active returns only active users
   * @business-rule Equality filter narrows result set to matching rows
   */
  it('should filter with ?status=eq.active', async () => {
    const response = await request(app).get('/users?status=eq.active');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    // Count expected active users from fixture data
    const expectedActive = FIXTURE_ROWS['users']!.filter(
      (u) => u['status'] === 'active',
    );
    expect(response.body).toHaveLength(expectedActive.length);

    for (const row of response.body) {
      expect(row.status).toBe('active');
    }
  });

  /**
   * @behavior Combined select, order, limit, and offset query params work together
   * @business-rule Multiple query features compose correctly in a single request
   */
  it('should support select, order, limit, offset together', async () => {
    // Request: select id and title from posts, order by id descending, limit 3, offset 2
    const response = await request(app).get(
      '/posts?select=id,title&order=id.desc&limit=3&offset=2',
    );

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(3);

    // Each row should only have id and title
    for (const row of response.body) {
      const keys = Object.keys(row);
      expect(keys).toHaveLength(2);
      expect(keys).toEqual(expect.arrayContaining(['id', 'title']));
    }

    // Posts sorted desc by id: [10,9,8,7,6,5,4,3,2,1], offset 2 => [8,7,6], limit 3
    expect(response.body[0].id).toBe(8);
    expect(response.body[1].id).toBe(7);
    expect(response.body[2].id).toBe(6);
  });

  /**
   * @behavior GET /posts?select=*,users(*) embeds the related user for each post
   * @business-rule Foreign key embedding resolves related rows as nested objects
   */
  it('should embed related rows with select=*,users(*)', async () => {
    const response = await request(app).get('/posts?select=*,users(*)');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);

    // Each post should have a nested users object with the referenced user's data
    for (const post of response.body) {
      expect(post).toHaveProperty('users');
      expect(post.users).not.toBeNull();
      expect(post.users).toHaveProperty('id');
      expect(post.users).toHaveProperty('email');
      expect(post.users).toHaveProperty('name');

      // Verify the embedded user matches the FK reference
      expect(post.users.id).toBe(post.user_id);
    }
  });

  /**
   * @behavior POST /users returns 201 with the request body echoed plus generated defaults
   * @business-rule Write endpoints return shaped responses without mutating the store
   */
  it('POST should return 201 with shaped response', async () => {
    const payload = { email: 'integration@example.com', name: 'Integration User' };

    const response = await request(app)
      .post('/users')
      .set('Content-Type', 'application/json')
      .set('Prefer', 'return=representation')
      .send(payload);

    expect(response.status).toBe(201);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);

    const created = response.body[0];
    expect(created.email).toBe(payload.email);
    expect(created.name).toBe(payload.name);

    // Generated defaults should be present
    expect(created).toHaveProperty('id');
    expect(typeof created.id).toBe('string');
    expect(created.id.length).toBeGreaterThan(0);
    expect(created).toHaveProperty('created_at');
    expect(created).toHaveProperty('status');
    expect(created.status).toBe('active'); // default from schema
  });

  /**
   * @behavior GET /nonexistent returns 404 with PostgREST-formatted error
   * @business-rule Unknown tables produce a 404 error with message, code, details, hint
   */
  it('should return 404 for unknown table', async () => {
    const response = await request(app).get('/nonexistent');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: expect.stringContaining('nonexistent'),
      code: 'PGRST200',
      details: null,
      hint: null,
    });
  });

  /**
   * @behavior GET /users with Prefer: count=exact includes Content-Range header
   * @business-rule Content-Range header format is "start-end/total" with correct total
   */
  it('should include Content-Range when Prefer: count=exact', async () => {
    const response = await request(app)
      .get('/users')
      .set('Prefer', 'count=exact');

    expect(response.status).toBe(200);

    const contentRange = response.headers['content-range'];
    expect(contentRange).toBeDefined();
    expect(contentRange).toMatch(/^\d+-\d+\/\d+$/);

    // Parse and verify the total matches fixture count
    const parts = contentRange.split('/');
    const total = parseInt(parts[1], 10);
    expect(total).toBe(FIXTURE_ROWS['users']!.length);

    // Verify range start-end is correct (0 to length-1)
    const rangeParts = parts[0].split('-');
    expect(parseInt(rangeParts[0], 10)).toBe(0);
    expect(parseInt(rangeParts[1], 10)).toBe(FIXTURE_ROWS['users']!.length - 1);
  });
});
