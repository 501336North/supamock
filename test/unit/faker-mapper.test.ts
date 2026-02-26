import { describe, it, expect } from 'vitest';
import { faker } from '@faker-js/faker';
import { mapColumn } from '../../src/faker-mapper.js';
import type { ColumnMetadata } from '../../src/types.js';

/**
 * Helper: build a ColumnMetadata with sensible defaults.
 * Override any field by passing partial overrides.
 */
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

// ─── Task 3: Comment Directives ───────────────────────────────────────────────

describe('Task 3 — Comment directives', () => {
  it('should resolve faker:internet.email comment to an email', () => {
    const col = makeColumn({ comment: 'faker:internet.email' });
    const gen = mapColumn(col, faker);
    const value = gen();
    expect(typeof value).toBe('string');
    expect(value as string).toMatch(/@/);
  });

  it('should resolve faker:person.firstName comment to a string', () => {
    const col = makeColumn({ comment: 'faker:person.firstName' });
    const gen = mapColumn(col, faker);
    const value = gen();
    expect(typeof value).toBe('string');
    expect((value as string).length).toBeGreaterThan(0);
  });

  it('should resolve faker paths with options like faker:number.int({"min":1,"max":10})', () => {
    const col = makeColumn({ comment: 'faker:number.int({"min":1,"max":10})' });
    const gen = mapColumn(col, faker);
    for (let i = 0; i < 50; i++) {
      const value = gen();
      expect(typeof value).toBe('number');
      expect(Number.isInteger(value)).toBe(true);
      expect(value as number).toBeGreaterThanOrEqual(1);
      expect(value as number).toBeLessThanOrEqual(10);
    }
  });

  it('should return undefined for invalid faker path', () => {
    const col = makeColumn({
      name: 'xyzzy',
      comment: 'faker:nonexistent.garbage',
      dataType: 'money',
      isNullable: true,
    });
    const gen = mapColumn(col, faker);
    // Invalid faker path falls through all resolvers; nullable catch-all returns null
    const value = gen();
    expect(value).toBeNull();
  });
});

// ─── Task 4: Column Name Heuristics ──────────────────────────────────────────

describe('Task 4 — Column name heuristics', () => {
  it('should map "email" column to email', () => {
    const col = makeColumn({ name: 'email' });
    const gen = mapColumn(col, faker);
    const value = gen();
    expect(typeof value).toBe('string');
    expect(value as string).toContain('@');
  });

  it('should map "first_name" column to first name', () => {
    const col = makeColumn({ name: 'first_name' });
    const gen = mapColumn(col, faker);
    const value = gen();
    expect(typeof value).toBe('string');
    expect((value as string).length).toBeGreaterThan(0);
  });

  it('should map "firstName" (camelCase) to first name', () => {
    const col = makeColumn({ name: 'firstName' });
    const gen = mapColumn(col, faker);
    const value = gen();
    expect(typeof value).toBe('string');
    expect((value as string).length).toBeGreaterThan(0);
  });

  it('should map "price" column to numeric value', () => {
    const col = makeColumn({ name: 'price' });
    const gen = mapColumn(col, faker);
    const value = gen();
    expect(typeof value).toBe('string');
    expect(Number.isNaN(parseFloat(value as string))).toBe(false);
  });

  it('should map "is_active" column to boolean', () => {
    const col = makeColumn({ name: 'is_active' });
    const gen = mapColumn(col, faker);
    const value = gen();
    expect(typeof value).toBe('boolean');
  });

  it('should map "created_at" column to a Date', () => {
    const col = makeColumn({ name: 'created_at' });
    const gen = mapColumn(col, faker);
    const value = gen();
    expect(value).toBeInstanceOf(Date);
  });

  it('should return undefined for unrecognized column name "xyzzy"', () => {
    const col = makeColumn({ name: 'xyzzy', isNullable: true });
    const gen = mapColumn(col, faker);
    // No comment, no pattern match, no constraints, no enum => type fallback
    // text type falls through to catch-all nullable => null
    // But actually text does have a type mapping. Let's use an obscure type.
    const col2 = makeColumn({ name: 'xyzzy', dataType: 'money', isNullable: true });
    const gen2 = mapColumn(col2, faker);
    const value = gen2();
    expect(value).toBeNull();
  });

  /**
   * Parameterized test for all 28 defined name patterns.
   * Skip /^id$/i since it maps based on type (uuid), not faker.
   */
  const NAME_PATTERN_TABLE: [string, (v: unknown) => void][] = [
    // /email/i
    ['email', (v) => { expect(typeof v).toBe('string'); expect(v as string).toContain('@'); }],
    ['user_email', (v) => { expect(typeof v).toBe('string'); expect(v as string).toContain('@'); }],
    // /first.?name/i
    ['first_name', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    ['firstName', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    // /last.?name/i
    ['last_name', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    ['lastName', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    // /^name$/i
    ['name', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    // /phone/i
    ['phone', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    ['phone_number', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    // /price|amount|cost|total/i
    ['price', (v) => { expect(typeof v).toBe('string'); expect(Number.isNaN(parseFloat(v as string))).toBe(false); }],
    ['total_amount', (v) => { expect(typeof v).toBe('string'); expect(Number.isNaN(parseFloat(v as string))).toBe(false); }],
    ['cost', (v) => { expect(typeof v).toBe('string'); expect(Number.isNaN(parseFloat(v as string))).toBe(false); }],
    // /avatar|image.?url/i
    ['avatar', (v) => { expect(typeof v).toBe('string'); expect(v as string).toMatch(/^https?:\/\//); }],
    ['image_url', (v) => { expect(typeof v).toBe('string'); expect(v as string).toMatch(/^https?:\/\//); }],
    // /url|website|homepage/i
    ['url', (v) => { expect(typeof v).toBe('string'); expect(v as string).toMatch(/^https?:\/\//); }],
    ['website', (v) => { expect(typeof v).toBe('string'); expect(v as string).toMatch(/^https?:\/\//); }],
    // /address/i
    ['address', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    // /city/i
    ['city', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    // /state/i
    ['state', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    // /zip|postal/i
    ['zip', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    ['postal_code', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    // /country/i
    ['country', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    // /description|bio|about/i
    ['description', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    ['bio', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    // /title|subject/i
    ['title', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    ['subject', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    // /username|user.?name/i
    ['username', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    ['user_name', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    // /password/i
    ['password', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    // /color/i
    ['color', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    // /company/i
    ['company', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThan(0); }],
    // /latitude|lat/i
    ['latitude', (v) => { expect(typeof v).toBe('number'); expect(v as number).toBeGreaterThanOrEqual(-90); expect(v as number).toBeLessThanOrEqual(90); }],
    ['lat', (v) => { expect(typeof v).toBe('number'); expect(v as number).toBeGreaterThanOrEqual(-90); expect(v as number).toBeLessThanOrEqual(90); }],
    // /longitude|lng|lon/i
    ['longitude', (v) => { expect(typeof v).toBe('number'); expect(v as number).toBeGreaterThanOrEqual(-180); expect(v as number).toBeLessThanOrEqual(180); }],
    ['lng', (v) => { expect(typeof v).toBe('number'); expect(v as number).toBeGreaterThanOrEqual(-180); expect(v as number).toBeLessThanOrEqual(180); }],
    // /created.?at|updated.?at|deleted.?at/i
    ['created_at', (v) => { expect(v).toBeInstanceOf(Date); }],
    ['updatedAt', (v) => { expect(v).toBeInstanceOf(Date); }],
    ['deleted_at', (v) => { expect(v).toBeInstanceOf(Date); }],
    // /is_.+|has_.+/i
    ['is_active', (v) => { expect(typeof v).toBe('boolean'); }],
    ['is_verified', (v) => { expect(typeof v).toBe('boolean'); }],
    ['has_subscription', (v) => { expect(typeof v).toBe('boolean'); }],
    // /count|quantity|qty/i
    ['count', (v) => { expect(typeof v).toBe('number'); expect(Number.isInteger(v)).toBe(true); }],
    ['quantity', (v) => { expect(typeof v).toBe('number'); expect(Number.isInteger(v)).toBe(true); }],
    ['qty', (v) => { expect(typeof v).toBe('number'); expect(Number.isInteger(v)).toBe(true); }],
    // /rating|score/i
    ['rating', (v) => { expect(typeof v).toBe('number'); expect(v as number).toBeGreaterThanOrEqual(1); expect(v as number).toBeLessThanOrEqual(5); }],
    ['score', (v) => { expect(typeof v).toBe('number'); expect(v as number).toBeGreaterThanOrEqual(1); expect(v as number).toBeLessThanOrEqual(5); }],
    // /slug/i
    ['slug', (v) => { expect(typeof v).toBe('string'); expect(v as string).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/); }],
    // /token|hash/i
    ['token', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThanOrEqual(16); }],
    ['hash', (v) => { expect(typeof v).toBe('string'); expect((v as string).length).toBeGreaterThanOrEqual(16); }],
    // /ip/i — match "ip" standalone or as "ip_address"
    ['ip', (v) => { expect(typeof v).toBe('string'); expect(v as string).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/); }],
    ['ip_address', (v) => { expect(typeof v).toBe('string'); expect(v as string).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/); }],
  ];

  it.each(NAME_PATTERN_TABLE)(
    'should map column name "%s" via name pattern heuristic',
    (columnName, validate) => {
      const col = makeColumn({ name: columnName });
      const gen = mapColumn(col, faker);
      const value = gen();
      validate(value);
    },
  );
});

// ─── Task 5: CHECK constraints, enum types, type fallback, catch-all ─────────

describe('Task 5 — CHECK constraints, enum types, type fallback, catch-all', () => {
  it('should pick only from CHECK IN values', () => {
    const allowed = ['pending', 'shipped', 'delivered'];
    const col = makeColumn({
      name: 'status',
      checkConstraint: allowed,
    });
    const gen = mapColumn(col, faker);
    for (let i = 0; i < 100; i++) {
      const value = gen();
      expect(allowed).toContain(value);
    }
  });

  it('should pick only from custom enum values', () => {
    const allowed = ['admin', 'user', 'moderator'];
    const col = makeColumn({
      name: 'role',
      enumValues: allowed,
    });
    const gen = mapColumn(col, faker);
    for (let i = 0; i < 100; i++) {
      const value = gen();
      expect(allowed).toContain(value);
    }
  });

  it('should map uuid type to valid UUID', () => {
    const col = makeColumn({ name: 'id', dataType: 'uuid' });
    const gen = mapColumn(col, faker);
    const value = gen();
    expect(typeof value).toBe('string');
    expect(value as string).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('should map integer type to a number', () => {
    const col = makeColumn({ name: 'xyzzy', dataType: 'integer' });
    const gen = mapColumn(col, faker);
    const value = gen();
    expect(typeof value).toBe('number');
    expect(Number.isInteger(value)).toBe(true);
  });

  it('should map boolean type to boolean', () => {
    const col = makeColumn({ name: 'xyzzy', dataType: 'boolean' });
    const gen = mapColumn(col, faker);
    const value = gen();
    expect(typeof value).toBe('boolean');
  });

  it('should map timestamptz type to Date', () => {
    const col = makeColumn({ name: 'xyzzy', dataType: 'timestamp with time zone' });
    const gen = mapColumn(col, faker);
    const value = gen();
    expect(value).toBeInstanceOf(Date);
  });

  it('should map jsonb type to empty object', () => {
    const col = makeColumn({ name: 'xyzzy', dataType: 'jsonb' });
    const gen = mapColumn(col, faker);
    const value = gen();
    expect(value).toEqual({});
  });

  it('should return null for unknown nullable type (catch-all)', () => {
    const col = makeColumn({ name: 'xyzzy', dataType: 'money', isNullable: true });
    const gen = mapColumn(col, faker);
    const value = gen();
    expect(value).toBeNull();
  });

  it('should return placeholder string for unknown NOT NULL type (catch-all)', () => {
    const col = makeColumn({ name: 'xyzzy', dataType: 'money', isNullable: false });
    const gen = mapColumn(col, faker);
    const value = gen();
    expect(value).toBe('<unsupported type: money>');
  });
});
