import { describe, it, expect } from 'vitest';
import { Faker, en } from '@faker-js/faker';
import { CrossDBRegistryImpl, generateWithDependencies } from '../../src/cross-db-registry.js';
import type { ColumnMetadata, TableMetadata, MockRecord } from '../../src/types.js';

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

// ─── Task 7: CrossDBRegistry ─────────────────────────────────────────────────

describe('Task 7 — CrossDBRegistry', () => {
  // 1. should store and retrieve records by table name
  it('should store and retrieve records by table name', () => {
    const registry = new CrossDBRegistryImpl();
    const users: MockRecord[] = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];

    registry.store('users', users);

    const retrieved = registry.get('users');
    expect(retrieved).toEqual(users);
    expect(retrieved).toHaveLength(2);
  });

  // 2. should return empty array for unknown table
  it('should return empty array for unknown table', () => {
    const registry = new CrossDBRegistryImpl();
    const result = registry.get('nonexistent');
    expect(result).toEqual([]);
  });

  // 3. should pick random FK value from parent records
  it('should pick random FK value from parent records', () => {
    const registry = new CrossDBRegistryImpl();
    const users: MockRecord[] = [
      { id: 10, name: 'Alice' },
      { id: 20, name: 'Bob' },
      { id: 30, name: 'Charlie' },
    ];
    registry.store('users', users);

    const validIds = [10, 20, 30];
    // Pick many times to verify it always returns a valid id
    for (let i = 0; i < 50; i++) {
      const picked = registry.pickForeignKey('users', 'id');
      expect(validIds).toContain(picked);
    }
  });

  // 4. should generate parent records proportionally (ceil(limit/3), min 1)
  it('should generate parent records proportionally (ceil(limit/3), min 1)', () => {
    const usersTable = makeTable('users', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'name', dataType: 'text' },
    ]);
    const postsTable = makeTable('posts', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'user_id', dataType: 'integer', foreignKey: { referencedTable: 'users', referencedColumn: 'id' } },
      { name: 'title', dataType: 'text' },
    ]);

    const tables = [usersTable, postsTable];
    const sortOrder = ['users', 'posts'];

    // Requesting 5 children -> ceil(5/3) = 2 parents
    const registry5 = new CrossDBRegistryImpl();
    generateWithDependencies('posts', 5, tables, sortOrder, registry5, seededFaker(42));
    const users5 = registry5.get('users');
    expect(users5).toHaveLength(2);

    // Requesting 1 child -> ceil(1/3) = 1 parent (min 1)
    const registry1 = new CrossDBRegistryImpl();
    generateWithDependencies('posts', 1, tables, sortOrder, registry1, seededFaker(42));
    const users1 = registry1.get('users');
    expect(users1).toHaveLength(1);
  });

  // 5. should resolve multi-level FK chains (grandchild -> child -> parent)
  it('should resolve multi-level FK chains (grandchild -> child -> parent)', () => {
    const countriesTable = makeTable('countries', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'name', dataType: 'text' },
    ]);
    const citiesTable = makeTable('cities', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'country_id', dataType: 'integer', foreignKey: { referencedTable: 'countries', referencedColumn: 'id' } },
      { name: 'name', dataType: 'text' },
    ]);
    const addressesTable = makeTable('addresses', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'city_id', dataType: 'integer', foreignKey: { referencedTable: 'cities', referencedColumn: 'id' } },
      { name: 'street', dataType: 'text' },
    ]);

    const tables = [countriesTable, citiesTable, addressesTable];
    const sortOrder = ['countries', 'cities', 'addresses'];

    const registry = new CrossDBRegistryImpl();
    const addresses = generateWithDependencies('addresses', 6, tables, sortOrder, registry, seededFaker(42));

    const countries = registry.get('countries');
    const cities = registry.get('cities');

    // All should have records
    expect(countries.length).toBeGreaterThan(0);
    expect(cities.length).toBeGreaterThan(0);
    expect(addresses).toHaveLength(6);

    // Validate FK chain: every address.city_id should reference a valid city.id
    const cityIds = new Set(cities.map((c) => c['id']));
    for (const addr of addresses) {
      expect(cityIds.has(addr['city_id'])).toBe(true);
    }

    // Validate FK chain: every city.country_id should reference a valid country.id
    const countryIds = new Set(countries.map((c) => c['id']));
    for (const city of cities) {
      expect(countryIds.has(city['country_id'])).toBe(true);
    }
  });

  // 6. should use topological order for generation
  it('should use topological order for generation', () => {
    const usersTable = makeTable('users', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'name', dataType: 'text' },
    ]);
    const postsTable = makeTable('posts', [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'user_id', dataType: 'integer', foreignKey: { referencedTable: 'users', referencedColumn: 'id' } },
      { name: 'title', dataType: 'text' },
    ]);

    const tables = [usersTable, postsTable];
    const sortOrder = ['users', 'posts'];

    const registry = new CrossDBRegistryImpl();
    generateWithDependencies('posts', 3, tables, sortOrder, registry, seededFaker(99));

    // Users (parent) must be in the registry before posts are generated.
    // Since generateWithDependencies processes in topological order,
    // users will be stored first, and posts will reference them.
    const users = registry.get('users');
    const posts = registry.get('posts');

    expect(users.length).toBeGreaterThan(0);
    expect(posts).toHaveLength(3);

    // Every post's user_id should be a valid user id
    const userIds = new Set(users.map((u) => u['id']));
    for (const post of posts) {
      expect(userIds.has(post['user_id'])).toBe(true);
    }
  });

  // 7. should not share state between separate instances (request isolation)
  it('should not share state between separate instances (request isolation)', () => {
    const registryA = new CrossDBRegistryImpl();
    const registryB = new CrossDBRegistryImpl();

    registryA.store('users', [{ id: 1, name: 'Alice' }]);
    registryB.store('products', [{ id: 100, title: 'Widget' }]);

    // Registry A should not see products from registry B
    expect(registryA.get('products')).toEqual([]);
    expect(registryA.get('users')).toHaveLength(1);

    // Registry B should not see users from registry A
    expect(registryB.get('users')).toEqual([]);
    expect(registryB.get('products')).toHaveLength(1);
  });
});
