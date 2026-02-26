import { describe, it, expect } from 'vitest';
import { Faker, en } from '@faker-js/faker';
import { generateRecords } from '../../src/mock-generator.js';
import type { ColumnMetadata, TableMetadata } from '../../src/types.js';

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

function seededFaker(seed: number): Faker {
  const f = new Faker({ locale: [en] });
  f.seed(seed);
  return f;
}

// ─── Task 6: MockGenerator ───────────────────────────────────────────────────

describe('Task 6 — MockGenerator', () => {
  // 1. should generate exactly N records
  it('should generate exactly N records', () => {
    const table = makeTable('users', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'email', dataType: 'text' },
    ]);

    const records5 = generateRecords(table, 5);
    expect(records5).toHaveLength(5);

    const records0 = generateRecords(table, 0);
    expect(records0).toHaveLength(0);

    const records100 = generateRecords(table, 100);
    expect(records100).toHaveLength(100);
  });

  // 2. should include all columns in each record
  it('should include all columns in each record', () => {
    const table = makeTable('products', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'name', dataType: 'text' },
      { name: 'price', dataType: 'numeric' },
      { name: 'description', dataType: 'text', isNullable: true },
    ]);

    const records = generateRecords(table, 10);
    const expectedKeys = ['id', 'name', 'price', 'description'];

    for (const record of records) {
      for (const key of expectedKeys) {
        expect(record).toHaveProperty(key);
      }
    }
  });

  // 3. should auto-increment integer PKs starting from 1
  it('should auto-increment integer PKs starting from 1', () => {
    const table = makeTable('orders', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'total', dataType: 'numeric' },
    ]);

    const records = generateRecords(table, 5);
    const ids = records.map((r) => r['id']);
    expect(ids).toEqual([1, 2, 3, 4, 5]);
  });

  // 4. should generate UUID PKs as valid UUIDs
  it('should generate UUID PKs as valid UUIDs', () => {
    const table = makeTable('sessions', [
      { name: 'id', dataType: 'uuid', isPrimaryKey: true },
      { name: 'token', dataType: 'text' },
    ]);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const records = generateRecords(table, 10);

    for (const record of records) {
      expect(typeof record['id']).toBe('string');
      expect(record['id'] as string).toMatch(uuidRegex);
    }

    // All UUIDs should be unique
    const uuids = new Set(records.map((r) => r['id']));
    expect(uuids.size).toBe(10);
  });

  // 5. should never return null for NOT NULL columns
  it('should never return null for NOT NULL columns', () => {
    const table = makeTable('profiles', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'email', dataType: 'text', isNullable: false },
      { name: 'username', dataType: 'text', isNullable: false },
      { name: 'score', dataType: 'integer', isNullable: false },
    ]);

    const records = generateRecords(table, 100);
    for (const record of records) {
      expect(record['email']).not.toBeNull();
      expect(record['username']).not.toBeNull();
      expect(record['score']).not.toBeNull();
    }
  });

  // 6. should return null approximately 20% of the time for nullable columns
  it('should return null approximately 20% of the time for nullable columns', () => {
    const table = makeTable('notes', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'body', dataType: 'text', isNullable: true },
    ]);

    const faker = seededFaker(42);
    const records = generateRecords(table, 500, faker);

    const nullCount = records.filter((r) => r['body'] === null).length;
    const nullRate = nullCount / 500;

    // 20% target: allow 15%..25% range
    expect(nullRate).toBeGreaterThanOrEqual(0.15);
    expect(nullRate).toBeLessThanOrEqual(0.25);
  });

  // 7. should produce no duplicate values for UNIQUE columns
  it('should produce no duplicate values for UNIQUE columns', () => {
    const table = makeTable('accounts', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'email', dataType: 'text', isUnique: true },
    ]);

    const records = generateRecords(table, 50);
    const emails = records.map((r) => r['email']);
    const uniqueEmails = new Set(emails);
    expect(uniqueEmails.size).toBe(emails.length);
  });

  // 8. should throw error when UNIQUE generation exhausts
  it('should throw error when UNIQUE generation exhausts', () => {
    // Boolean column can only produce true/false, so requesting 3+ unique values is impossible
    const table = makeTable('flags', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'is_active', dataType: 'boolean', isUnique: true, isNullable: false },
    ]);

    expect(() => generateRecords(table, 5)).toThrow(/unique/i);
  });

  // 9. should use seeded Faker for deterministic output
  it('should use seeded Faker for deterministic output', () => {
    const table = makeTable('users', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'email', dataType: 'text' },
      { name: 'username', dataType: 'text' },
    ]);

    const faker1 = seededFaker(123);
    const faker2 = seededFaker(123);

    const records1 = generateRecords(table, 10, faker1);
    const records2 = generateRecords(table, 10, faker2);

    expect(records1).toEqual(records2);
  });

  // 10. should use FakerMapper to resolve each column value
  it('should use FakerMapper to resolve each column value', () => {
    // Use a column with a comment directive so we can verify FakerMapper is used
    const table = makeTable('contacts', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'contact_email', dataType: 'text', comment: 'faker:internet.email' },
    ]);

    const records = generateRecords(table, 10);

    // Every record should have an email-like value (contains @)
    // This proves FakerMapper resolved the comment directive
    for (const record of records) {
      expect(typeof record['contact_email']).toBe('string');
      expect(record['contact_email'] as string).toContain('@');
    }
  });

  // ─── Additional edge cases ─────────────────────────────────────────────────

  it('should handle serial PK type with auto-increment', () => {
    const table = makeTable('items', [
      { name: 'id', dataType: 'serial', isPrimaryKey: true },
      { name: 'name', dataType: 'text' },
    ]);

    const records = generateRecords(table, 3);
    expect(records.map((r) => r['id'])).toEqual([1, 2, 3]);
  });

  it('should handle FK columns by generating a value (placeholder for CrossDBRegistry)', () => {
    const table = makeTable('posts', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'user_id', dataType: 'integer', foreignKey: { referencedTable: 'users', referencedColumn: 'id' } },
    ]);

    const records = generateRecords(table, 5);
    for (const record of records) {
      // FK columns should get some value (not undefined), CrossDBRegistry overrides later
      expect(record['user_id']).toBeDefined();
    }
  });

  it('should handle enum columns by picking from allowed values', () => {
    const table = makeTable('tasks', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'status', dataType: 'text', enumValues: ['open', 'in_progress', 'done'] },
    ]);

    const records = generateRecords(table, 20);
    const allowedValues = ['open', 'in_progress', 'done'];
    for (const record of records) {
      expect(allowedValues).toContain(record['status']);
    }
  });

  it('should handle check constraint columns by picking from allowed values', () => {
    const table = makeTable('shipments', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'priority', dataType: 'text', checkConstraint: ['low', 'medium', 'high'] },
    ]);

    const records = generateRecords(table, 20);
    const allowedValues = ['low', 'medium', 'high'];
    for (const record of records) {
      expect(allowedValues).toContain(record['priority']);
    }
  });
});
