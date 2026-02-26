import { describe, it, expect } from 'vitest';
import { resolveExpansions } from '../../src/expand-resolver.js';
import { CrossDBRegistryImpl } from '../../src/cross-db-registry.js';
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

/**
 * Build a pre-populated registry for expansion tests.
 * Creates users, products, and orders tables with known data.
 */
function buildTestRegistry(): CrossDBRegistryImpl {
  const registry = new CrossDBRegistryImpl();

  registry.store('users', [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
  ]);

  registry.store('products', [
    { id: 100, title: 'Widget', price: 9.99 },
    { id: 200, title: 'Gadget', price: 19.99 },
  ]);

  return registry;
}

/** Orders table metadata with FK to users and products */
function ordersTable(): TableMetadata {
  return makeTable('orders', [
    { name: 'id', dataType: 'integer', isPrimaryKey: true },
    { name: 'user_id', dataType: 'integer', foreignKey: { referencedTable: 'users', referencedColumn: 'id' } },
    { name: 'product_id', dataType: 'integer', foreignKey: { referencedTable: 'products', referencedColumn: 'id' } },
    { name: 'quantity', dataType: 'integer' },
  ]);
}

// ─── Task 8: ExpandResolver ──────────────────────────────────────────────────

describe('Task 8 — ExpandResolver', () => {
  // 1. should inline single relation with ?expand=user
  it('should inline single relation with ?expand=user', () => {
    const registry = buildTestRegistry();
    const table = ordersTable();
    const orders: MockRecord[] = [
      { id: 1, user_id: 1, product_id: 100, quantity: 2 },
      { id: 2, user_id: 2, product_id: 200, quantity: 1 },
    ];

    const result = resolveExpansions(
      orders,
      { expand: 'user' },
      registry,
      table,
      'rest',
    );

    expect(result.error).toBeUndefined();
    expect(result.records).toHaveLength(2);

    // First order should have user Alice
    expect(result.records[0]['user']).toEqual({ id: 1, name: 'Alice', email: 'alice@example.com' });
    // Second order should have user Bob
    expect(result.records[1]['user']).toEqual({ id: 2, name: 'Bob', email: 'bob@example.com' });
  });

  // 2. should inline multiple relations with ?expand=user,product
  it('should inline multiple relations with ?expand=user,product', () => {
    const registry = buildTestRegistry();
    const table = ordersTable();
    const orders: MockRecord[] = [
      { id: 1, user_id: 1, product_id: 100, quantity: 3 },
    ];

    const result = resolveExpansions(
      orders,
      { expand: 'user,product' },
      registry,
      table,
      'rest',
    );

    expect(result.error).toBeUndefined();
    expect(result.records).toHaveLength(1);

    const order = result.records[0];
    expect(order['user']).toEqual({ id: 1, name: 'Alice', email: 'alice@example.com' });
    expect(order['product']).toEqual({ id: 100, title: 'Widget', price: 9.99 });
  });

  // 3. should return error for invalid relation name
  it('should return error for invalid relation name', () => {
    const registry = buildTestRegistry();
    const table = ordersTable();
    const orders: MockRecord[] = [
      { id: 1, user_id: 1, product_id: 100, quantity: 1 },
    ];

    const result = resolveExpansions(
      orders,
      { expand: 'nonexistent' },
      registry,
      table,
      'rest',
    );

    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain('nonexistent');
    // Error should list valid relation names
    expect(result.error!.message).toContain('user');
    expect(result.error!.message).toContain('product');
  });

  // 4. should parse Supabase select syntax: select=*,user(*)
  it('should parse Supabase select syntax: select=*,user(*)', () => {
    const registry = buildTestRegistry();
    const table = ordersTable();
    const orders: MockRecord[] = [
      { id: 1, user_id: 1, product_id: 100, quantity: 2 },
    ];

    const result = resolveExpansions(
      orders,
      { select: '*,user(*)' },
      registry,
      table,
      'supabase',
    );

    expect(result.error).toBeUndefined();
    expect(result.records).toHaveLength(1);
    expect(result.records[0]['user']).toEqual({ id: 1, name: 'Alice', email: 'alice@example.com' });
  });

  // 5. should reject ?expand in Supabase mode
  it('should reject ?expand in Supabase mode', () => {
    const registry = buildTestRegistry();
    const table = ordersTable();
    const orders: MockRecord[] = [
      { id: 1, user_id: 1, product_id: 100, quantity: 1 },
    ];

    const result = resolveExpansions(
      orders,
      { expand: 'user' },
      registry,
      table,
      'supabase',
    );

    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(400);
    expect(result.error!.message).toContain('expand');
  });

  // 6. should reject ?select in REST mode
  it('should reject ?select in REST mode', () => {
    const registry = buildTestRegistry();
    const table = ordersTable();
    const orders: MockRecord[] = [
      { id: 1, user_id: 1, product_id: 100, quantity: 1 },
    ];

    const result = resolveExpansions(
      orders,
      { select: '*,user(*)' },
      registry,
      table,
      'rest',
    );

    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(400);
    expect(result.error!.message).toContain('select');
  });
});
