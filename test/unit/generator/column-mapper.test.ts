/**
 * Column Name Mapper Tests
 *
 * @behavior Maps column names to appropriate Faker.js generator functions
 * @business-rule Realistic mock data is generated based on column semantics (name heuristics first, type fallbacks second)
 */

import { describe, it, expect } from 'vitest';
import { faker } from '@faker-js/faker';
import type { ColumnInfo } from '../../../src/types.js';
import { mapColumn } from '../../../src/generator/column-mapper.js';

/** Helper to build a ColumnInfo with sensible defaults */
function makeColumn(overrides: Partial<ColumnInfo> & Pick<ColumnInfo, 'name' | 'type'>): ColumnInfo {
  return {
    nullable: false,
    defaultValue: null,
    isEnum: false,
    enumValues: [],
    isUnique: false,
    ...overrides,
  };
}

describe('mapColumn', () => {
  it('should map "email" column name to faker.internet.email()', () => {
    const column = makeColumn({ name: 'email', type: 'text' });
    const generator = mapColumn(column);

    expect(generator).not.toBeNull();
    const value = generator!();
    expect(typeof value).toBe('string');
    expect(value as string).toMatch(/.+@.+\..+/);
  });

  it('should map "first_name" column name to faker.person.firstName()', () => {
    const column = makeColumn({ name: 'first_name', type: 'text' });
    const generator = mapColumn(column);

    expect(generator).not.toBeNull();
    const value = generator!();
    expect(typeof value).toBe('string');
    expect((value as string).length).toBeGreaterThan(0);
  });

  it('should map "phone" column name to faker.phone.number()', () => {
    const column = makeColumn({ name: 'phone', type: 'text' });
    const generator = mapColumn(column);

    expect(generator).not.toBeNull();
    const value = generator!();
    expect(typeof value).toBe('string');
    expect((value as string).length).toBeGreaterThan(0);
  });

  it('should map "avatar_url" column name to faker.image.avatar()', () => {
    const column = makeColumn({ name: 'avatar_url', type: 'text' });
    const generator = mapColumn(column);

    expect(generator).not.toBeNull();
    const value = generator!();
    expect(typeof value).toBe('string');
    expect(() => new URL(value as string)).not.toThrow();
  });

  it('should fall back to type-based generation for unknown column names', () => {
    // text -> sentence
    const textCol = makeColumn({ name: 'misc_field', type: 'text' });
    const textGen = mapColumn(textCol);
    expect(textGen).not.toBeNull();
    expect(typeof textGen!()).toBe('string');

    // integer -> int
    const intCol = makeColumn({ name: 'misc_count', type: 'integer' });
    const intGen = mapColumn(intCol);
    expect(intGen).not.toBeNull();
    expect(typeof intGen!()).toBe('number');

    // boolean -> boolean
    const boolCol = makeColumn({ name: 'misc_flag', type: 'boolean' });
    const boolGen = mapColumn(boolCol);
    expect(boolGen).not.toBeNull();
    expect(typeof boolGen!()).toBe('boolean');

    // uuid -> uuid string
    const uuidCol = makeColumn({ name: 'misc_ref', type: 'uuid' });
    const uuidGen = mapColumn(uuidCol);
    expect(uuidGen).not.toBeNull();
    const uuidValue = uuidGen!() as string;
    expect(uuidValue).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    // timestamptz -> ISO string
    const tsCol = makeColumn({ name: 'misc_at', type: 'timestamptz' });
    const tsGen = mapColumn(tsCol);
    expect(tsGen).not.toBeNull();
    const tsValue = tsGen!() as string;
    expect(tsValue).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should return null for unsupported Postgres types (geometry, hstore, tsvector)', () => {
    const geometryCol = makeColumn({ name: 'location', type: 'geometry' });
    expect(mapColumn(geometryCol)).toBeNull();

    const hstoreCol = makeColumn({ name: 'metadata', type: 'hstore' });
    expect(mapColumn(hstoreCol)).toBeNull();

    const tsvectorCol = makeColumn({ name: 'search_index', type: 'tsvector' });
    expect(mapColumn(tsvectorCol)).toBeNull();
  });

  it('should handle column names case-insensitively', () => {
    const upperEmail = makeColumn({ name: 'Email', type: 'text' });
    const genUpper = mapColumn(upperEmail);
    expect(genUpper).not.toBeNull();
    expect(genUpper!() as string).toMatch(/.+@.+\..+/);

    const allCapsEmail = makeColumn({ name: 'EMAIL', type: 'text' });
    const genAllCaps = mapColumn(allCapsEmail);
    expect(genAllCaps).not.toBeNull();
    expect(genAllCaps!() as string).toMatch(/.+@.+\..+/);
  });
});
