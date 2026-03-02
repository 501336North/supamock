import { parseQuery, parsePreferHeader } from '../../../src/server/query-parser.js';
import type {
  PostgRESTQuery,
  SelectClause,
  EmbedClause,
  Filter,
  FilterOperator,
  OrderClause,
  PreferHeader,
} from '../../../src/types.js';

// ============================================================
// Task 9: Select, Order, Limit, Offset
// ============================================================
describe('parseQuery - select', () => {
  it('should parse select=id,email into column list', () => {
    const result = parseQuery({ select: 'id,email' });

    expect(result.select.columns).toEqual(['id', 'email']);
    expect(result.select.embeds).toEqual([]);
  });

  it('should parse select=* as all columns', () => {
    const result = parseQuery({ select: '*' });

    expect(result.select.columns).toBe('*');
    expect(result.select.embeds).toEqual([]);
  });

  it('should parse select=*,posts(*) as embed clause', () => {
    const result = parseQuery({ select: '*,posts(*)' });

    expect(result.select.columns).toBe('*');
    expect(result.select.embeds).toEqual([
      { relation: 'posts', columns: '*' },
    ]);
  });

  it('should parse select=id,title,users(id,email) as mixed select with embed', () => {
    const result = parseQuery({ select: 'id,title,users(id,email)' });

    expect(result.select.columns).toEqual(['id', 'title']);
    expect(result.select.embeds).toEqual([
      { relation: 'users', columns: ['id', 'email'] },
    ]);
  });
});

describe('parseQuery - order', () => {
  it('should parse order=created_at.desc', () => {
    const result = parseQuery({ order: 'created_at.desc' });

    expect(result.order).toEqual([
      { column: 'created_at', direction: 'desc' },
    ]);
  });

  it('should parse order=last_name.asc,first_name.asc (multiple)', () => {
    const result = parseQuery({ order: 'last_name.asc,first_name.asc' });

    expect(result.order).toEqual([
      { column: 'last_name', direction: 'asc' },
      { column: 'first_name', direction: 'asc' },
    ]);
  });

  it('should reject invalid sort direction with descriptive error', () => {
    expect(() => parseQuery({ order: 'name.upward' })).toThrow('upward');
    expect(() => parseQuery({ order: 'name.upward' })).toThrow('asc');
    expect(() => parseQuery({ order: 'name.upward' })).toThrow('desc');
  });

  it('should reject empty direction after dot', () => {
    expect(() => parseQuery({ order: 'name.' })).toThrow();
  });
});

describe('parseQuery - limit and offset', () => {
  it('should parse limit=5 and offset=10', () => {
    const result = parseQuery({ limit: '5', offset: '10' });

    expect(result.limit).toBe(5);
    expect(result.offset).toBe(10);
  });

  it('should default limit to 0 (unlimited) and offset to 0', () => {
    const result = parseQuery({});

    expect(result.limit).toBe(0);
    expect(result.offset).toBe(0);
  });

  it('should coerce non-numeric limit to 0', () => {
    const result = parseQuery({ limit: 'abc' });

    expect(result.limit).toBe(0);
  });

  it('should coerce negative offset to 0', () => {
    const result = parseQuery({ offset: '-5' });

    expect(result.offset).toBe(0);
  });

  it('should coerce negative limit to 0', () => {
    const result = parseQuery({ limit: '-10' });

    expect(result.limit).toBe(0);
  });

  it('should coerce non-numeric offset to 0', () => {
    const result = parseQuery({ offset: 'xyz' });

    expect(result.offset).toBe(0);
  });

  it('should coerce Infinity limit to 0', () => {
    const result = parseQuery({ limit: 'Infinity' });

    expect(result.limit).toBe(0);
  });
});

// ============================================================
// Task 10: Filter Operators
// ============================================================
describe('parseQuery - filters', () => {
  it('should parse status=eq.active as equality filter', () => {
    const result = parseQuery({ status: 'eq.active' });

    expect(result.filters).toEqual([
      { column: 'status', operator: 'eq', value: 'active' },
    ]);
  });

  it('should parse price=gt.10 as greater-than filter', () => {
    const result = parseQuery({ price: 'gt.10' });

    expect(result.filters).toEqual([
      { column: 'price', operator: 'gt', value: '10' },
    ]);
  });

  it('should parse role=in.(admin,editor) as IN filter', () => {
    const result = parseQuery({ role: 'in.(admin,editor)' });

    expect(result.filters).toEqual([
      { column: 'role', operator: 'in', value: ['admin', 'editor'] },
    ]);
  });

  it('should parse name=ilike.*john* as case-insensitive pattern', () => {
    const result = parseQuery({ name: 'ilike.*john*' });

    expect(result.filters).toEqual([
      { column: 'name', operator: 'ilike', value: '*john*' },
    ]);
  });

  it('should parse deleted_at=is.null as IS NULL filter', () => {
    const result = parseQuery({ deleted_at: 'is.null' });

    expect(result.filters).toEqual([
      { column: 'deleted_at', operator: 'is', value: null },
    ]);
  });

  it('should parse multiple filters on different columns as AND', () => {
    const result = parseQuery({
      status: 'eq.active',
      role: 'eq.admin',
    });

    expect(result.filters).toHaveLength(2);
    expect(result.filters).toEqual(
      expect.arrayContaining([
        { column: 'status', operator: 'eq', value: 'active' },
        { column: 'role', operator: 'eq', value: 'admin' },
      ]),
    );
  });

  it('should parse all operators: neq, gte, lte, lt, like', () => {
    const neqResult = parseQuery({ age: 'neq.30' });
    expect(neqResult.filters[0]).toEqual({
      column: 'age',
      operator: 'neq',
      value: '30',
    });

    const gteResult = parseQuery({ score: 'gte.90' });
    expect(gteResult.filters[0]).toEqual({
      column: 'score',
      operator: 'gte',
      value: '90',
    });

    const lteResult = parseQuery({ price: 'lte.100' });
    expect(lteResult.filters[0]).toEqual({
      column: 'price',
      operator: 'lte',
      value: '100',
    });

    const ltResult = parseQuery({ count: 'lt.5' });
    expect(ltResult.filters[0]).toEqual({
      column: 'count',
      operator: 'lt',
      value: '5',
    });

    const likeResult = parseQuery({ name: 'like.%john%' });
    expect(likeResult.filters[0]).toEqual({
      column: 'name',
      operator: 'like',
      value: '%john%',
    });
  });

  it('should reject unknown operators with descriptive error', () => {
    expect(() => parseQuery({ status: 'banana.active' })).toThrow('banana');
  });
});

// ============================================================
// Task 11: Prefer Header
// ============================================================
describe('parsePreferHeader', () => {
  it('should parse Prefer: count=exact', () => {
    const result = parsePreferHeader('count=exact');

    expect(result).toEqual({ count: 'exact' });
  });

  it('should parse Prefer: return=representation', () => {
    const result = parsePreferHeader('return=representation');

    expect(result).toEqual({ return: 'representation' });
  });

  it('should parse Prefer: return=minimal', () => {
    const result = parsePreferHeader('return=minimal');

    expect(result).toEqual({ return: 'minimal' });
  });

  it('should handle missing Prefer header', () => {
    const result = parsePreferHeader(undefined);

    expect(result).toEqual({});
  });
});

describe('parseQuery - prefer header integration', () => {
  it('should pass prefer header through to the parsed query', () => {
    const result = parseQuery({ select: '*' }, 'return=representation');

    expect(result.prefer).toEqual({ return: 'representation' });
  });

  it('should default prefer to empty object when no header provided', () => {
    const result = parseQuery({ select: '*' });

    expect(result.prefer).toEqual({});
  });
});
