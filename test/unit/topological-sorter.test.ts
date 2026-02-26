import { describe, it, expect } from 'vitest';
import { topologicalSort } from '../../src/topological-sorter.js';
import type { TableMetadata, ColumnMetadata, ForeignKey } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeColumn(
  name: string,
  opts: Partial<ColumnMetadata> = {},
): ColumnMetadata {
  return {
    name,
    dataType: opts.dataType ?? 'text',
    isNullable: opts.isNullable ?? false,
    isUnique: opts.isUnique ?? false,
    isPrimaryKey: opts.isPrimaryKey ?? false,
    foreignKey: opts.foreignKey ?? null,
    checkConstraint: opts.checkConstraint ?? null,
    enumValues: opts.enumValues ?? null,
    comment: opts.comment ?? null,
    columnDefault: opts.columnDefault ?? null,
  };
}

function makeTable(name: string, columns: ColumnMetadata[]): TableMetadata {
  return { name, columns };
}

function makeFk(referencedTable: string, referencedColumn: string = 'id'): ForeignKey {
  return { referencedTable, referencedColumn };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('topologicalSort', () => {
  it('should return single table unchanged', () => {
    const users = makeTable('users', [
      makeColumn('id', { isPrimaryKey: true, dataType: 'uuid' }),
      makeColumn('name'),
    ]);

    const result = topologicalSort([users]);

    expect(result.order).toEqual(['users']);
    expect(result.brokenEdges).toEqual([]);
  });

  it('should order parent before child', () => {
    const users = makeTable('users', [
      makeColumn('id', { isPrimaryKey: true, dataType: 'uuid' }),
      makeColumn('name'),
    ]);

    const orders = makeTable('orders', [
      makeColumn('id', { isPrimaryKey: true, dataType: 'uuid' }),
      makeColumn('user_id', { foreignKey: makeFk('users') }),
    ]);

    const result = topologicalSort([orders, users]);

    expect(result.order).toEqual(['users', 'orders']);
    expect(result.brokenEdges).toEqual([]);
  });

  it('should handle multi-level chains', () => {
    const users = makeTable('users', [
      makeColumn('id', { isPrimaryKey: true, dataType: 'uuid' }),
    ]);

    const orders = makeTable('orders', [
      makeColumn('id', { isPrimaryKey: true, dataType: 'uuid' }),
      makeColumn('user_id', { foreignKey: makeFk('users') }),
    ]);

    const items = makeTable('items', [
      makeColumn('id', { isPrimaryKey: true, dataType: 'uuid' }),
      makeColumn('order_id', { foreignKey: makeFk('orders') }),
    ]);

    const result = topologicalSort([items, orders, users]);

    expect(result.order).toEqual(['users', 'orders', 'items']);
    expect(result.brokenEdges).toEqual([]);
  });

  it('should handle tables with no FK relationships', () => {
    const users = makeTable('users', [
      makeColumn('id', { isPrimaryKey: true }),
      makeColumn('name'),
    ]);

    const products = makeTable('products', [
      makeColumn('id', { isPrimaryKey: true }),
      makeColumn('title'),
    ]);

    const categories = makeTable('categories', [
      makeColumn('id', { isPrimaryKey: true }),
      makeColumn('label'),
    ]);

    const result = topologicalSort([users, products, categories]);

    // All three tables must be present; order is not constrained
    expect(result.order).toHaveLength(3);
    expect(result.order).toContain('users');
    expect(result.order).toContain('products');
    expect(result.order).toContain('categories');
    expect(result.brokenEdges).toEqual([]);
  });

  it('should detect circular references and break at nullable FK', () => {
    // employees.manager_id -> employees (self-referential, nullable)
    // departments.head_id -> employees (nullable)
    // employees.department_id -> departments (NOT nullable)
    //
    // Cycle: employees -> departments -> employees
    // The nullable FK (departments.head_id -> employees) should be broken.

    const employees = makeTable('employees', [
      makeColumn('id', { isPrimaryKey: true, dataType: 'uuid' }),
      makeColumn('department_id', {
        foreignKey: makeFk('departments'),
        isNullable: false,
      }),
      makeColumn('manager_id', {
        foreignKey: makeFk('employees'),
        isNullable: true,
      }),
    ]);

    const departments = makeTable('departments', [
      makeColumn('id', { isPrimaryKey: true, dataType: 'uuid' }),
      makeColumn('head_id', {
        foreignKey: makeFk('employees'),
        isNullable: true,
      }),
    ]);

    const result = topologicalSort([employees, departments]);

    // Both tables must appear in the order
    expect(result.order).toHaveLength(2);
    expect(result.order).toContain('employees');
    expect(result.order).toContain('departments');

    // At least one edge was broken, and it should be a nullable one
    expect(result.brokenEdges.length).toBeGreaterThanOrEqual(1);
    const broken = result.brokenEdges[0];
    expect(broken).toEqual(
      expect.objectContaining({
        fromTable: expect.any(String),
        toTable: expect.any(String),
        column: expect.any(String),
      }),
    );

    // The broken edge must be from a nullable FK column
    // departments.head_id (nullable) -> employees is the expected break
    const brokenIsNullable = result.brokenEdges.every((edge) => {
      const sourceTable = [employees, departments].find(
        (t) => t.name === edge.fromTable,
      );
      const col = sourceTable?.columns.find((c) => c.name === edge.column);
      return col?.isNullable === true;
    });
    expect(brokenIsNullable).toBe(true);
  });

  it('should handle multiple FKs from one table', () => {
    const users = makeTable('users', [
      makeColumn('id', { isPrimaryKey: true, dataType: 'uuid' }),
    ]);

    const products = makeTable('products', [
      makeColumn('id', { isPrimaryKey: true, dataType: 'uuid' }),
    ]);

    const reviews = makeTable('reviews', [
      makeColumn('id', { isPrimaryKey: true, dataType: 'uuid' }),
      makeColumn('user_id', { foreignKey: makeFk('users') }),
      makeColumn('product_id', { foreignKey: makeFk('products') }),
    ]);

    const result = topologicalSort([reviews, users, products]);

    // reviews must come after both users and products
    const reviewsIdx = result.order.indexOf('reviews');
    const usersIdx = result.order.indexOf('users');
    const productsIdx = result.order.indexOf('products');

    expect(reviewsIdx).toBeGreaterThan(usersIdx);
    expect(reviewsIdx).toBeGreaterThan(productsIdx);
    expect(result.brokenEdges).toEqual([]);
  });
});
