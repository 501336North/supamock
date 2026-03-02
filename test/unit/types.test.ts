/**
 * Type Compilation Tests — Shared Types
 *
 * @behavior All core types compile with strict TypeScript and match the API contract
 * @business-rule Types define the shared vocabulary for schema, queries, and data
 *
 * These tests verify structural correctness via type-level assertions.
 * If any type is missing or structurally wrong, the file won't compile.
 */

import { describe, it, expect } from 'vitest';
import type {
  SchemaDefinition,
  TableInfo,
  ColumnInfo,
  ForeignKey,
  PostgRESTQuery,
  Filter,
  FilterOperator,
  SelectClause,
  EmbedClause,
  OrderClause,
  SortDirection,
  PreferHeader,
  PostgRESTError,
  MockRow,
} from '../../src/types.js';

describe('Shared Types', () => {
  it('should export SchemaDefinition type with tables array', () => {
    const schema: SchemaDefinition = {
      tables: [],
    };
    expect(schema.tables).toEqual([]);
  });

  it('should export TableInfo with name, columns, primaryKey, foreignKeys', () => {
    const table: TableInfo = {
      name: 'users',
      columns: [],
      primaryKey: ['id'],
      foreignKeys: [],
    };
    expect(table.name).toBe('users');
    expect(table.primaryKey).toEqual(['id']);
  });

  it('should export ColumnInfo with name, type, nullable, defaultValue, isEnum, enumValues', () => {
    const column: ColumnInfo = {
      name: 'email',
      type: 'text',
      nullable: false,
      defaultValue: null,
      isEnum: false,
      enumValues: [],
      isUnique: false,
    };
    expect(column.name).toBe('email');
    expect(column.nullable).toBe(false);
  });

  it('should export ForeignKey with column, referencedTable, referencedColumn', () => {
    const fk: ForeignKey = {
      column: 'user_id',
      referencedTable: 'users',
      referencedColumn: 'id',
    };
    expect(fk.column).toBe('user_id');
    expect(fk.referencedTable).toBe('users');
  });

  it('should export PostgRESTQuery, Filter, SelectClause, EmbedClause, OrderClause types', () => {
    const embed: EmbedClause = {
      relation: 'posts',
      columns: '*',
    };

    const select: SelectClause = {
      columns: '*',
      embeds: [embed],
    };

    const filter: Filter = {
      column: 'status',
      operator: 'eq',
      value: 'active',
    };

    const order: OrderClause = {
      column: 'created_at',
      direction: 'desc',
    };

    const prefer: PreferHeader = {
      count: 'exact',
      return: 'representation',
    };

    const query: PostgRESTQuery = {
      select,
      filters: [filter],
      order: [order],
      limit: 10,
      offset: 0,
      prefer,
    };

    expect(query.select.columns).toBe('*');
    expect(query.filters).toHaveLength(1);
    expect(query.order[0]!.direction).toBe('desc');
  });

  it('should export PostgRESTError with message, code, details, hint', () => {
    const error: PostgRESTError = {
      message: 'Not found',
      code: 'PGRST200',
      details: null,
      hint: null,
    };
    expect(error.code).toBe('PGRST200');
  });

  it('should export MockRow as Record<string, unknown>', () => {
    const row: MockRow = {
      id: '123',
      email: 'test@example.com',
      count: 42,
      active: true,
    };
    expect(row['id']).toBe('123');
  });

  it('should export FilterOperator union type', () => {
    const operators: FilterOperator[] = [
      'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is',
    ];
    expect(operators).toHaveLength(10);
  });

  it('should export SortDirection union type', () => {
    const directions: SortDirection[] = ['asc', 'desc'];
    expect(directions).toHaveLength(2);
  });
});
