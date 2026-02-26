import { describe, it, expect } from 'vitest';
import type {
  ForeignKey,
  ColumnMetadata,
  TableMetadata,
  ServerConfig,
  MockRecord,
  CrossDBRegistry,
  SortResult,
  BrokenEdge,
  FormattedResponse,
  ResponseMeta,
  ExpandParams,
  ExpandResult,
} from '../../src/types.js';

describe('ForeignKey', () => {
  it('should have referencedTable and referencedColumn fields', () => {
    const fk: ForeignKey = {
      referencedTable: 'users',
      referencedColumn: 'id',
    };

    expect(fk.referencedTable).toBe('users');
    expect(fk.referencedColumn).toBe('id');
    expect(Object.keys(fk)).toEqual(['referencedTable', 'referencedColumn']);
  });
});

describe('ColumnMetadata', () => {
  it('should include all required fields', () => {
    const column: ColumnMetadata = {
      name: 'email',
      dataType: 'varchar',
      isNullable: false,
      isUnique: true,
      isPrimaryKey: false,
      foreignKey: null,
      checkConstraint: null,
      enumValues: null,
      comment: 'faker:internet.email',
      columnDefault: null,
    };

    expect(column.name).toBe('email');
    expect(column.dataType).toBe('varchar');
    expect(column.isNullable).toBe(false);
    expect(column.isUnique).toBe(true);
    expect(column.isPrimaryKey).toBe(false);
    expect(column.foreignKey).toBeNull();
    expect(column.checkConstraint).toBeNull();
    expect(column.enumValues).toBeNull();
    expect(column.comment).toBe('faker:internet.email');
    expect(column.columnDefault).toBeNull();
  });

  it('should accept a ForeignKey reference', () => {
    const column: ColumnMetadata = {
      name: 'user_id',
      dataType: 'uuid',
      isNullable: false,
      isUnique: false,
      isPrimaryKey: false,
      foreignKey: {
        referencedTable: 'users',
        referencedColumn: 'id',
      },
      checkConstraint: null,
      enumValues: null,
      comment: null,
      columnDefault: null,
    };

    expect(column.foreignKey).not.toBeNull();
    expect(column.foreignKey!.referencedTable).toBe('users');
    expect(column.foreignKey!.referencedColumn).toBe('id');
  });

  it('should accept checkConstraint and enumValues arrays', () => {
    const column: ColumnMetadata = {
      name: 'status',
      dataType: 'text',
      isNullable: false,
      isUnique: false,
      isPrimaryKey: false,
      foreignKey: null,
      checkConstraint: ['active', 'inactive', 'pending'],
      enumValues: ['active', 'inactive', 'pending'],
      comment: null,
      columnDefault: "'active'",
    };

    expect(column.checkConstraint).toEqual(['active', 'inactive', 'pending']);
    expect(column.enumValues).toEqual(['active', 'inactive', 'pending']);
    expect(column.columnDefault).toBe("'active'");
  });

  it('should have exactly the expected set of keys', () => {
    const column: ColumnMetadata = {
      name: 'id',
      dataType: 'uuid',
      isNullable: false,
      isUnique: true,
      isPrimaryKey: true,
      foreignKey: null,
      checkConstraint: null,
      enumValues: null,
      comment: null,
      columnDefault: 'gen_random_uuid()',
    };

    const expectedKeys = [
      'name',
      'dataType',
      'isNullable',
      'isUnique',
      'isPrimaryKey',
      'foreignKey',
      'checkConstraint',
      'enumValues',
      'comment',
      'columnDefault',
    ];

    expect(Object.keys(column).sort()).toEqual(expectedKeys.sort());
  });
});

describe('TableMetadata', () => {
  it('should compile with valid structure', () => {
    const table: TableMetadata = {
      name: 'users',
      columns: [
        {
          name: 'id',
          dataType: 'uuid',
          isNullable: false,
          isUnique: true,
          isPrimaryKey: true,
          foreignKey: null,
          checkConstraint: null,
          enumValues: null,
          comment: null,
          columnDefault: 'gen_random_uuid()',
        },
        {
          name: 'email',
          dataType: 'varchar',
          isNullable: false,
          isUnique: true,
          isPrimaryKey: false,
          foreignKey: null,
          checkConstraint: null,
          enumValues: null,
          comment: 'faker:internet.email',
          columnDefault: null,
        },
      ],
    };

    expect(table.name).toBe('users');
    expect(table.columns).toHaveLength(2);
    expect(table.columns[0].isPrimaryKey).toBe(true);
    expect(table.columns[1].comment).toBe('faker:internet.email');
  });

  it('should accept an empty columns array', () => {
    const table: TableMetadata = {
      name: 'empty_table',
      columns: [],
    };

    expect(table.name).toBe('empty_table');
    expect(table.columns).toHaveLength(0);
  });
});

describe('ServerConfig', () => {
  it('should accept rest format', () => {
    const config: ServerConfig = {
      dbUrl: 'postgresql://localhost:5432/test',
      port: 3000,
      defaultCount: 10,
      format: 'rest',
    };

    expect(config.format).toBe('rest');
    expect(config.port).toBe(3000);
  });

  it('should accept supabase format', () => {
    const config: ServerConfig = {
      dbUrl: 'postgresql://localhost:5432/test',
      port: 54321,
      defaultCount: 25,
      format: 'supabase',
    };

    expect(config.format).toBe('supabase');
    expect(config.defaultCount).toBe(25);
  });
});

describe('MockRecord', () => {
  it('should accept a record with unknown values', () => {
    const record: MockRecord = {
      id: 'abc-123',
      name: 'John Doe',
      age: 30,
      isActive: true,
      metadata: { nested: 'value' },
      tags: ['a', 'b'],
    };

    expect(record['id']).toBe('abc-123');
    expect(record['name']).toBe('John Doe');
    expect(Object.keys(record)).toHaveLength(6);
  });
});

describe('SortResult and BrokenEdge', () => {
  it('should represent a topological sort result', () => {
    const brokenEdge: BrokenEdge = {
      fromTable: 'orders',
      toTable: 'users',
      column: 'user_id',
    };

    const sortResult: SortResult = {
      order: ['users', 'products', 'orders'],
      brokenEdges: [brokenEdge],
    };

    expect(sortResult.order).toHaveLength(3);
    expect(sortResult.brokenEdges).toHaveLength(1);
    expect(sortResult.brokenEdges[0].fromTable).toBe('orders');
  });

  it('should allow empty brokenEdges', () => {
    const sortResult: SortResult = {
      order: ['users', 'posts'],
      brokenEdges: [],
    };

    expect(sortResult.brokenEdges).toHaveLength(0);
  });
});

describe('FormattedResponse', () => {
  it('should hold a body and headers', () => {
    const response: FormattedResponse = {
      body: [{ id: 1, name: 'Test' }],
      headers: {
        'content-type': 'application/json',
        'x-total-count': '100',
      },
    };

    expect(response.headers['content-type']).toBe('application/json');
    expect(Array.isArray(response.body)).toBe(true);
  });
});

describe('ResponseMeta', () => {
  it('should hold pagination metadata', () => {
    const meta: ResponseMeta = {
      total: 100,
      limit: 25,
      offset: 0,
    };

    expect(meta.total).toBe(100);
    expect(meta.limit).toBe(25);
    expect(meta.offset).toBe(0);
  });
});

describe('ExpandParams', () => {
  it('should accept optional expand and select fields', () => {
    const restParams: ExpandParams = {
      expand: 'users,posts',
    };
    expect(restParams.expand).toBe('users,posts');
    expect(restParams.select).toBeUndefined();

    const supabaseParams: ExpandParams = {
      select: 'id,name,posts(id,title)',
    };
    expect(supabaseParams.select).toBe('id,name,posts(id,title)');
    expect(supabaseParams.expand).toBeUndefined();

    const emptyParams: ExpandParams = {};
    expect(emptyParams.expand).toBeUndefined();
    expect(emptyParams.select).toBeUndefined();
  });
});

describe('ExpandResult', () => {
  it('should hold records with optional error', () => {
    const success: ExpandResult = {
      records: [{ id: 1 }, { id: 2 }],
    };
    expect(success.records).toHaveLength(2);
    expect(success.error).toBeUndefined();

    const failure: ExpandResult = {
      records: [],
      error: { status: 404, message: 'Table not found' },
    };
    expect(failure.records).toHaveLength(0);
    expect(failure.error).toBeDefined();
    expect(failure.error!.status).toBe(404);
    expect(failure.error!.message).toBe('Table not found');
  });
});

describe('CrossDBRegistry interface shape', () => {
  it('should define store, get, and pickForeignKey methods', () => {
    // Verify the interface shape by creating a mock implementation
    const mockRegistry: CrossDBRegistry = {
      store(tableName: string, records: MockRecord[]): void {
        // no-op for type verification
        void tableName;
        void records;
      },
      get(tableName: string): MockRecord[] {
        void tableName;
        return [];
      },
      pickForeignKey(tableName: string, columnName: string): unknown {
        void tableName;
        void columnName;
        return null;
      },
    };

    expect(typeof mockRegistry.store).toBe('function');
    expect(typeof mockRegistry.get).toBe('function');
    expect(typeof mockRegistry.pickForeignKey).toBe('function');

    // Verify return types at runtime
    mockRegistry.store('users', [{ id: 1 }]);
    expect(mockRegistry.get('users')).toEqual([]);
    expect(mockRegistry.pickForeignKey('users', 'id')).toBeNull();
  });
});
