/**
 * Data Generator Tests
 *
 * @behavior Generates fake rows for a table using column mappers, with support for
 *           FK references, unique constraints, and seeded determinism.
 * @business-rule Each generated row must respect column types, nullability,
 *                enum constraints, FK relationships, and uniqueness.
 */

import { describe, it, expect } from 'vitest';
import type { TableInfo, MockRow } from '../../../src/types.js';
import { generateRows } from '../../../src/generator/data-generator.js';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const usersTable: TableInfo = {
  name: 'users',
  columns: [
    { name: 'id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
    { name: 'email', type: 'text', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
    { name: 'name', type: 'text', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
    { name: 'status', type: 'text', nullable: false, defaultValue: null, isEnum: true, enumValues: ['active', 'inactive', 'banned'], isUnique: false },
    { name: 'bio', type: 'text', nullable: true, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
    { name: 'created_at', type: 'timestamptz', nullable: false, defaultValue: 'now()', isEnum: false, enumValues: [], isUnique: false },
  ],
  primaryKey: ['id'],
  foreignKeys: [],
};

const postsTable: TableInfo = {
  name: 'posts',
  columns: [
    { name: 'id', type: 'integer', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
    { name: 'title', type: 'text', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
    { name: 'user_id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
  ],
  primaryKey: ['id'],
  foreignKeys: [{ column: 'user_id', referencedTable: 'users', referencedColumn: 'id' }],
};

// ─── Task 6: Core Row Generation ────────────────────────────────────────────

describe('generateRows — core row generation', () => {
  it('should generate the requested number of rows', () => {
    const rows = generateRows(usersTable, 20);

    expect(rows).toHaveLength(20);
  });

  it('should produce type-correct values for integer columns', () => {
    const rows = generateRows(postsTable, 10, 1);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(typeof row['id']).toBe('number');
    }
  });

  it('should produce type-correct values for text columns', () => {
    const rows = generateRows(usersTable, 10, 1);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(typeof row['name']).toBe('string');
    }
  });

  it('should produce type-correct values for boolean columns', () => {
    const boolTable: TableInfo = {
      name: 'flags',
      columns: [
        { name: 'is_active', type: 'boolean', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
      ],
      primaryKey: [],
      foreignKeys: [],
    };

    const rows = generateRows(boolTable, 10, 1);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(typeof row['is_active']).toBe('boolean');
    }
  });

  it('should produce type-correct values for uuid columns', () => {
    const rows = generateRows(usersTable, 10, 1);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row['id']).toMatch(uuidRegex);
    }
  });

  it('should produce type-correct values for timestamptz columns', () => {
    const rows = generateRows(usersTable, 10, 1);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const value = row['created_at'] as string;
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(new Date(value).toISOString()).toBe(value);
    }
  });

  it('should never produce null for NOT NULL columns', () => {
    const rows = generateRows(usersTable, 50, 1);

    expect(rows.length).toBeGreaterThan(0);
    const notNullColumns = usersTable.columns.filter((c) => !c.nullable);

    for (const row of rows) {
      for (const col of notNullColumns) {
        expect(row[col.name]).not.toBeNull();
        expect(row[col.name]).not.toBeUndefined();
      }
    }
  });

  it('should only produce valid enum values for enum columns', () => {
    const rows = generateRows(usersTable, 50, 1);
    const validStatuses = ['active', 'inactive', 'banned'];

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(validStatuses).toContain(row['status']);
    }
  });
});

// ─── Task 7: FK References, Unique, & Determinism ──────────────────────────

describe('generateRows — FK references, unique, and determinism', () => {
  it('should assign FK values from existing parent table rows', () => {
    const parentUsers: MockRow[] = generateRows(usersTable, 5, 100);
    const parentData: Record<string, MockRow[]> = { users: parentUsers };

    const posts = generateRows(postsTable, 20, 1, parentData);

    expect(posts.length).toBeGreaterThan(0);
    const validUserIds = new Set(parentUsers.map((u) => u['id']));

    for (const post of posts) {
      expect(validUserIds.has(post['user_id'])).toBe(true);
    }
  });

  it('should generate unique values for columns with unique constraints', () => {
    const rows = generateRows(usersTable, 50, 1);

    expect(rows.length).toBeGreaterThan(0);
    const ids = rows.map((r) => r['id']);
    expect(new Set(ids).size).toBe(ids.length);

    const emails = rows.map((r) => r['email']);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('should produce identical rows given the same seed', () => {
    const run1 = generateRows(usersTable, 20, 42);
    const run2 = generateRows(usersTable, 20, 42);

    expect(run1.length).toBeGreaterThan(0);
    expect(run1).toEqual(run2);
  });

  it('should produce different rows given different seeds', () => {
    const run1 = generateRows(usersTable, 20, 42);
    const run2 = generateRows(usersTable, 20, 99);

    expect(run1.length).toBeGreaterThan(0);
    expect(run1).not.toEqual(run2);
  });

  it('should set nullable FK columns to null when parent data is unavailable', () => {
    const commentsTable: TableInfo = {
      name: 'comments',
      columns: [
        { name: 'id', type: 'integer', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
        { name: 'post_id', type: 'integer', nullable: true, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
      ],
      primaryKey: ['id'],
      foreignKeys: [{ column: 'post_id', referencedTable: 'posts', referencedColumn: 'id' }],
    };

    // parentData does NOT include 'posts', simulating circular dependency
    const rows = generateRows(commentsTable, 10, 1, {});

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row['post_id']).toBeNull();
    }
  });
});
