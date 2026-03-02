import {
  formatListResponse,
  formatErrorResponse,
  applyFilters,
  applySelect,
  applyOrder,
  applyPagination,
  embedRelations,
} from '../../../src/server/response-formatter.js';
import type {
  MockRow,
  SchemaDefinition,
  PostgRESTQuery,
  SelectClause,
  Filter,
  OrderClause,
  EmbedClause,
} from '../../../src/types.js';

// ============================================================
// Test Fixtures
// ============================================================
const rows: MockRow[] = [
  { id: 1, name: 'Alice', email: 'alice@test.com', age: 30, status: 'active' },
  { id: 2, name: 'Bob', email: 'bob@test.com', age: 25, status: 'inactive' },
  { id: 3, name: 'Carol', email: 'carol@test.com', age: 35, status: 'active' },
  { id: 4, name: 'Dave', email: 'dave@test.com', age: 28, status: 'banned' },
  { id: 5, name: 'Eve', email: 'eve@test.com', age: 32, status: 'active' },
];

const embedSchema: SchemaDefinition = {
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
      ],
      primaryKey: ['id'],
      foreignKeys: [],
    },
    {
      name: 'posts',
      columns: [
        { name: 'id', type: 'integer', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
        { name: 'user_id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
      ],
      primaryKey: ['id'],
      foreignKeys: [{ column: 'user_id', referencedTable: 'users', referencedColumn: 'id' }],
    },
  ],
};

// ============================================================
// Task 12: Response Formatter
// ============================================================
describe('formatListResponse', () => {
  it('should return filtered rows as JSON array', () => {
    const query: PostgRESTQuery = {
      select: { columns: '*', embeds: [] },
      filters: [{ column: 'status', operator: 'eq', value: 'active' }],
      order: [],
      limit: 0,
      offset: 0,
      prefer: {},
    };
    const schema: SchemaDefinition = { tables: [] };

    const result = formatListResponse(rows, query, schema, 'users', {});

    expect(result.body).toHaveLength(3);
    expect(result.body.every((r) => r['status'] === 'active')).toBe(true);
    expect(result.headers['Content-Type']).toBe('application/json');
  });
});

describe('applySelect', () => {
  it('should select only requested columns', () => {
    const select: SelectClause = { columns: ['id', 'email'], embeds: [] };

    const result = applySelect(rows, select);

    expect(result).toHaveLength(5);
    expect(Object.keys(result[0]!)).toEqual(['id', 'email']);
    expect(result[0]).toEqual({ id: 1, email: 'alice@test.com' });
    expect(result[1]).toEqual({ id: 2, email: 'bob@test.com' });
  });
});

describe('embedRelations', () => {
  it('should embed related rows as nested objects', () => {
    const postRows: MockRow[] = [
      { id: 101, user_id: 'u1', title: 'Post A' },
      { id: 102, user_id: 'u2', title: 'Post B' },
    ];
    const userRows: MockRow[] = [
      { id: 'u1', name: 'Alice' },
      { id: 'u2', name: 'Bob' },
    ];
    const embeds: EmbedClause[] = [{ relation: 'users', columns: '*' }];
    const allData: Record<string, MockRow[]> = {
      users: userRows,
      posts: postRows,
    };

    const result = embedRelations(postRows, embeds, 'posts', embedSchema, allData);

    expect(result[0]).toEqual({
      id: 101,
      user_id: 'u1',
      title: 'Post A',
      users: { id: 'u1', name: 'Alice' },
    });
    expect(result[1]).toEqual({
      id: 102,
      user_id: 'u2',
      title: 'Post B',
      users: { id: 'u2', name: 'Bob' },
    });
  });
});

describe('applyFilters', () => {
  it('should apply filters correctly (eq, neq, gt, lt, in, like, ilike, is)', () => {
    // eq
    const eqResult = applyFilters(rows, [{ column: 'name', operator: 'eq', value: 'Alice' }]);
    expect(eqResult).toHaveLength(1);
    expect(eqResult[0]!['name']).toBe('Alice');

    // neq
    const neqResult = applyFilters(rows, [{ column: 'status', operator: 'neq', value: 'active' }]);
    expect(neqResult).toHaveLength(2);
    expect(neqResult.every((r) => r['status'] !== 'active')).toBe(true);

    // gt (numeric)
    const gtResult = applyFilters(rows, [{ column: 'age', operator: 'gt', value: '30' }]);
    expect(gtResult).toHaveLength(2);
    expect(gtResult.map((r) => r['name'])).toEqual(['Carol', 'Eve']);

    // lt (numeric)
    const ltResult = applyFilters(rows, [{ column: 'age', operator: 'lt', value: '28' }]);
    expect(ltResult).toHaveLength(1);
    expect(ltResult[0]!['name']).toBe('Bob');

    // gte
    const gteResult = applyFilters(rows, [{ column: 'age', operator: 'gte', value: '32' }]);
    expect(gteResult).toHaveLength(2);
    expect(gteResult.map((r) => r['name'])).toEqual(['Carol', 'Eve']);

    // lte
    const lteResult = applyFilters(rows, [{ column: 'age', operator: 'lte', value: '25' }]);
    expect(lteResult).toHaveLength(1);
    expect(lteResult[0]!['name']).toBe('Bob');

    // in
    const inResult = applyFilters(rows, [{ column: 'status', operator: 'in', value: ['active', 'banned'] }]);
    expect(inResult).toHaveLength(4);

    // like (case-sensitive, * is wildcard)
    const likeResult = applyFilters(rows, [{ column: 'name', operator: 'like', value: '*li*' }]);
    expect(likeResult).toHaveLength(1);
    expect(likeResult[0]!['name']).toBe('Alice');

    // ilike (case-insensitive)
    const ilikeResult = applyFilters(rows, [{ column: 'name', operator: 'ilike', value: '*LI*' }]);
    expect(ilikeResult).toHaveLength(1);
    expect(ilikeResult[0]!['name']).toBe('Alice');

    // is (null check)
    const rowsWithNull: MockRow[] = [
      { id: 1, deleted_at: null },
      { id: 2, deleted_at: '2024-01-01' },
      { id: 3 }, // deleted_at is undefined
    ];
    const isResult = applyFilters(rowsWithNull, [{ column: 'deleted_at', operator: 'is', value: null }]);
    expect(isResult).toHaveLength(2);
    expect(isResult.map((r) => r['id'])).toEqual([1, 3]);
  });
});

describe('applyOrder', () => {
  it('should apply ordering', () => {
    const ascResult = applyOrder([...rows], [{ column: 'age', direction: 'asc' }]);
    expect(ascResult.map((r) => r['name'])).toEqual(['Bob', 'Dave', 'Alice', 'Eve', 'Carol']);

    const descResult = applyOrder([...rows], [{ column: 'age', direction: 'desc' }]);
    expect(descResult.map((r) => r['name'])).toEqual(['Carol', 'Eve', 'Alice', 'Dave', 'Bob']);

    // Multi-column ordering
    const multiRows: MockRow[] = [
      { id: 1, status: 'active', age: 30 },
      { id: 2, status: 'active', age: 25 },
      { id: 3, status: 'banned', age: 35 },
    ];
    const multiResult = applyOrder(multiRows, [
      { column: 'status', direction: 'asc' },
      { column: 'age', direction: 'desc' },
    ]);
    expect(multiResult.map((r) => r['id'])).toEqual([1, 2, 3]);
  });
});

describe('applyPagination', () => {
  it('should apply limit and offset', () => {
    const limitResult = applyPagination(rows, 2, 0);
    expect(limitResult).toHaveLength(2);
    expect(limitResult.map((r) => r['name'])).toEqual(['Alice', 'Bob']);

    const offsetResult = applyPagination(rows, 2, 2);
    expect(offsetResult).toHaveLength(2);
    expect(offsetResult.map((r) => r['name'])).toEqual(['Carol', 'Dave']);

    // limit=0 means no limit
    const noLimitResult = applyPagination(rows, 0, 1);
    expect(noLimitResult).toHaveLength(4);
    expect(noLimitResult[0]!['name']).toBe('Bob');
  });
});

describe('formatListResponse - Content-Range header', () => {
  it('should include Content-Range header when Prefer: count=exact', () => {
    const query: PostgRESTQuery = {
      select: { columns: '*', embeds: [] },
      filters: [],
      order: [],
      limit: 2,
      offset: 1,
      prefer: { count: 'exact' },
    };
    const schema: SchemaDefinition = { tables: [] };

    const result = formatListResponse(rows, query, schema, 'users', {});

    expect(result.body).toHaveLength(2);
    expect(result.headers['Content-Range']).toBe('1-2/5');
    expect(result.headers['Content-Type']).toBe('application/json');
  });
});

describe('formatErrorResponse', () => {
  it('should format PostgREST error responses', () => {
    const error = formatErrorResponse(
      'Table not found',
      'PGRST204',
      'The table "foo" does not exist',
      'Check the table name',
    );

    expect(error).toEqual({
      message: 'Table not found',
      code: 'PGRST204',
      details: 'The table "foo" does not exist',
      hint: 'Check the table name',
    });
  });
});
