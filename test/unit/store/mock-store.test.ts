/**
 * MockStore Tests
 *
 * @behavior Stores generated mock data in memory and provides lookup by table name and primary key
 * @business-rule Data is seeded in dependency order (parents first) so foreign key references are valid
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SchemaDefinition, TableInfo, MockRow } from '../../../src/types.js';
import { MockStore } from '../../../src/store/mock-store.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const schema: SchemaDefinition = {
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
        { name: 'email', type: 'text', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
      ],
      primaryKey: ['id'],
      foreignKeys: [],
    },
    {
      name: 'posts',
      columns: [
        { name: 'id', type: 'integer', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
        { name: 'title', type: 'text', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
        { name: 'user_id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
      ],
      primaryKey: ['id'],
      foreignKeys: [{ column: 'user_id', referencedTable: 'users', referencedColumn: 'id' }],
    },
  ],
};

const fixtureRows: Record<string, MockRow[]> = {
  users: [
    { id: 'user-1', email: 'alice@test.com' },
    { id: 'user-2', email: 'bob@test.com' },
  ],
  posts: [
    { id: 1, title: 'Post A', user_id: 'user-1' },
    { id: 2, title: 'Post B', user_id: 'user-2' },
  ],
};

const orderItemsTable: TableInfo = {
  name: 'order_items',
  columns: [
    { name: 'order_id', type: 'integer', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
    { name: 'product_id', type: 'integer', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
    { name: 'quantity', type: 'integer', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
  ],
  primaryKey: ['order_id', 'product_id'],
  foreignKeys: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MockStore', () => {
  let store: MockStore;

  beforeEach(() => {
    store = new MockStore(schema);
  });

  it('should store and retrieve rows by table name', () => {
    store.seedFromData(fixtureRows);

    const users = store.getRows('users');
    expect(users).toEqual(fixtureRows['users']);

    const posts = store.getRows('posts');
    expect(posts).toEqual(fixtureRows['posts']);
  });

  it('should return undefined for unknown table', () => {
    store.seedFromData(fixtureRows);

    const result = store.getRows('nonexistent');
    expect(result).toBeUndefined();
  });

  it('should look up a row by primary key', () => {
    store.seedFromData(fixtureRows);

    const user = store.findByPK('users', { id: 'user-1' });
    expect(user).toEqual({ id: 'user-1', email: 'alice@test.com' });
  });

  it('should return all table names', () => {
    store.seedFromData(fixtureRows);

    const names = store.getTableNames();
    expect(names).toEqual(expect.arrayContaining(['users', 'posts']));
    expect(names).toHaveLength(2);
  });

  it('should look up a row by composite primary key', () => {
    const compositeSchema: SchemaDefinition = {
      tables: [...schema.tables, orderItemsTable],
    };
    const compositeStore = new MockStore(compositeSchema);

    const compositeRows: Record<string, MockRow[]> = {
      ...fixtureRows,
      order_items: [
        { order_id: 100, product_id: 200, quantity: 3 },
        { order_id: 100, product_id: 300, quantity: 1 },
        { order_id: 101, product_id: 200, quantity: 5 },
      ],
    };
    compositeStore.seedFromData(compositeRows);

    const item = compositeStore.findByPK('order_items', { order_id: 100, product_id: 300 });
    expect(item).toEqual({ order_id: 100, product_id: 300, quantity: 1 });

    const missing = compositeStore.findByPK('order_items', { order_id: 999, product_id: 999 });
    expect(missing).toBeUndefined();
  });

  it('should seed all tables in dependency order using generator', async () => {
    const callOrder: string[] = [];
    const parentDataSnapshots: Record<string, Record<string, MockRow[]>> = {};

    const mockGenerateRows = vi.fn(
      (table: TableInfo, _count: number, _seed?: number, parentData?: Record<string, MockRow[]>) => {
        callOrder.push(table.name);
        // Snapshot parentData at the time of the call
        if (parentData) {
          parentDataSnapshots[table.name] = {};
          for (const [key, val] of Object.entries(parentData)) {
            parentDataSnapshots[table.name]![key] = [...val];
          }
        }
        // Return identifiable rows
        return [{ id: `${table.name}-row-1` }];
      },
    );

    // Clear module cache so the dynamic import picks up the mock
    vi.resetModules();

    // Mock the data-generator module
    vi.doMock('../../../src/generator/data-generator.js', () => ({
      generateRows: mockGenerateRows,
    }));

    // Re-import MockStore to pick up the mock
    const { MockStore: MockStoreWithMock } = await import('../../../src/store/mock-store.js');
    const seededStore = new MockStoreWithMock(schema);

    seededStore.seed(5, 42);

    // Verify parents are generated before children
    expect(callOrder.indexOf('users')).toBeLessThan(callOrder.indexOf('posts'));

    // Verify generateRows was called for each table
    expect(mockGenerateRows).toHaveBeenCalledTimes(2);

    // Verify parentData was passed when generating posts
    const postsParentData = parentDataSnapshots['posts'];
    expect(postsParentData).toBeDefined();
    expect(postsParentData!['users']).toEqual([{ id: 'users-row-1' }]);

    // Verify the rows are stored
    expect(seededStore.getRows('users')).toEqual([{ id: 'users-row-1' }]);
    expect(seededStore.getRows('posts')).toEqual([{ id: 'posts-row-1' }]);

    // Cleanup
    vi.doUnmock('../../../src/generator/data-generator.js');
  });
});
