/**
 * Schema Introspector — Unit Tests
 *
 * @behavior Queries Postgres information_schema and pg_catalog to discover
 *           tables, columns, foreign keys, primary keys, unique constraints,
 *           and enum types, returning a typed SchemaDefinition.
 * @business-rule The introspector is the only code that touches the real
 *               database; everything downstream works from the SchemaDefinition
 *               value object. Mocking pg.Client keeps these tests fast and
 *               deterministic.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { introspectSchema } from '../../../src/schema/introspector.js';
import type { SchemaDefinition } from '../../../src/types.js';

// ---- Mock pg.Client (London TDD: mock the collaborator) --------------------

interface MockClient {
  query: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
}

function createMockClient(): MockClient {
  return {
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
  };
}

// ---- Helpers for building pg query result shapes ---------------------------

interface PgQueryResult<T> {
  rows: T[];
  rowCount: number;
}

function pgResult<T>(rows: T[]): PgQueryResult<T> {
  return { rows, rowCount: rows.length };
}

// ---- Test Suite ------------------------------------------------------------

describe('Schema Introspector', () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  // ---------- Task 2: Table & Column Discovery ------------------------------

  describe('Table & Column Discovery', () => {
    it('should discover all tables in the public schema', async () => {
      // Arrange — mock queries in bulk order: tables, columns(bulk), FK, PK, unique, enums
      mockClient.query
        .mockResolvedValueOnce(
          pgResult([
            { table_name: 'users' },
            { table_name: 'posts' },
          ]),
        )
        // columns (single bulk query with table_name)
        .mockResolvedValueOnce(
          pgResult([
            { table_name: 'users', column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'gen_random_uuid()' },
            { table_name: 'users', column_name: 'email', data_type: 'text', is_nullable: 'NO', column_default: null },
            { table_name: 'posts', column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: "nextval('posts_id_seq')" },
            { table_name: 'posts', column_name: 'title', data_type: 'text', is_nullable: 'NO', column_default: null },
          ]),
        )
        // foreign keys (empty for this test)
        .mockResolvedValueOnce(pgResult([]))
        // primary keys
        .mockResolvedValueOnce(pgResult([]))
        // unique constraints
        .mockResolvedValueOnce(pgResult([]))
        // enums
        .mockResolvedValueOnce(pgResult([]));

      // Act
      const schema: SchemaDefinition = await introspectSchema(mockClient as never);

      // Assert
      expect(schema.tables).toHaveLength(2);
      expect(schema.tables.map((t) => t.name)).toEqual(['users', 'posts']);
    });

    it('should extract column name, type, nullable, and default for each table', async () => {
      // Arrange
      mockClient.query
        // tables
        .mockResolvedValueOnce(
          pgResult([{ table_name: 'users' }]),
        )
        // columns (bulk)
        .mockResolvedValueOnce(
          pgResult([
            { table_name: 'users', column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'gen_random_uuid()' },
            { table_name: 'users', column_name: 'email', data_type: 'text', is_nullable: 'NO', column_default: null },
            { table_name: 'users', column_name: 'bio', data_type: 'text', is_nullable: 'YES', column_default: "'N/A'" },
          ]),
        )
        // foreign keys
        .mockResolvedValueOnce(pgResult([]))
        // primary keys
        .mockResolvedValueOnce(pgResult([]))
        // unique constraints
        .mockResolvedValueOnce(pgResult([]))
        // enums
        .mockResolvedValueOnce(pgResult([]));

      // Act
      const schema = await introspectSchema(mockClient as never);

      // Assert
      const users = schema.tables[0]!;
      expect(users.columns).toHaveLength(3);

      const idCol = users.columns.find((c) => c.name === 'id')!;
      expect(idCol.type).toBe('uuid');
      expect(idCol.nullable).toBe(false);
      expect(idCol.defaultValue).toBe('gen_random_uuid()');

      const emailCol = users.columns.find((c) => c.name === 'email')!;
      expect(emailCol.type).toBe('text');
      expect(emailCol.nullable).toBe(false);
      expect(emailCol.defaultValue).toBeNull();

      const bioCol = users.columns.find((c) => c.name === 'bio')!;
      expect(bioCol.type).toBe('text');
      expect(bioCol.nullable).toBe(true);
      expect(bioCol.defaultValue).toBe("'N/A'");
    });

    it('should use the specified schema name instead of public', async () => {
      // Arrange
      mockClient.query
        .mockResolvedValueOnce(pgResult([{ table_name: 'accounts' }]))
        // columns (bulk)
        .mockResolvedValueOnce(
          pgResult([
            { table_name: 'accounts', column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null },
          ]),
        )
        // foreign keys
        .mockResolvedValueOnce(pgResult([]))
        // primary keys
        .mockResolvedValueOnce(pgResult([]))
        // unique constraints
        .mockResolvedValueOnce(pgResult([]))
        // enums
        .mockResolvedValueOnce(pgResult([]));

      // Act
      await introspectSchema(mockClient as never, 'custom_schema');

      // Assert — verify the FIRST call (tables query) used the custom schema
      const tablesQueryCall = mockClient.query.mock.calls[0] as [string, string[]];
      expect(tablesQueryCall[1]).toContain('custom_schema');
    });

    it('should return empty tables array when no tables exist', async () => {
      // Arrange
      mockClient.query
        .mockResolvedValueOnce(pgResult([]))
        // columns (bulk — empty since no tables)
        .mockResolvedValueOnce(pgResult([]))
        // foreign keys
        .mockResolvedValueOnce(pgResult([]))
        // primary keys
        .mockResolvedValueOnce(pgResult([]))
        // unique constraints
        .mockResolvedValueOnce(pgResult([]))
        // enums
        .mockResolvedValueOnce(pgResult([]));

      // Act
      const schema = await introspectSchema(mockClient as never);

      // Assert
      expect(schema.tables).toEqual([]);
    });
  });

  // ---------- Task 3: Foreign Keys, Constraints & Enums ---------------------

  describe('Foreign Keys, Constraints & Enums', () => {
    it('should extract foreign keys with source column, target table, and target column', async () => {
      // Arrange
      mockClient.query
        // tables
        .mockResolvedValueOnce(pgResult([{ table_name: 'posts' }]))
        // columns (bulk)
        .mockResolvedValueOnce(
          pgResult([
            { table_name: 'posts', column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null },
            { table_name: 'posts', column_name: 'user_id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
          ]),
        )
        // foreign keys
        .mockResolvedValueOnce(
          pgResult([
            {
              source_table: 'posts',
              source_column: 'user_id',
              target_table: 'users',
              target_column: 'id',
            },
          ]),
        )
        // primary keys
        .mockResolvedValueOnce(pgResult([]))
        // unique constraints
        .mockResolvedValueOnce(pgResult([]))
        // enums
        .mockResolvedValueOnce(pgResult([]));

      // Act
      const schema = await introspectSchema(mockClient as never);

      // Assert
      const posts = schema.tables[0]!;
      expect(posts.foreignKeys).toHaveLength(1);
      expect(posts.foreignKeys[0]).toEqual({
        column: 'user_id',
        referencedTable: 'users',
        referencedColumn: 'id',
      });
    });

    it('should extract primary key columns for each table', async () => {
      // Arrange
      mockClient.query
        // tables
        .mockResolvedValueOnce(
          pgResult([{ table_name: 'users' }, { table_name: 'post_tags' }]),
        )
        // columns (bulk — both tables in one result)
        .mockResolvedValueOnce(
          pgResult([
            { table_name: 'users', column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
            { table_name: 'post_tags', column_name: 'post_id', data_type: 'integer', is_nullable: 'NO', column_default: null },
            { table_name: 'post_tags', column_name: 'tag_id', data_type: 'integer', is_nullable: 'NO', column_default: null },
          ]),
        )
        // foreign keys
        .mockResolvedValueOnce(pgResult([]))
        // primary keys
        .mockResolvedValueOnce(
          pgResult([
            { table_name: 'users', column_name: 'id' },
            { table_name: 'post_tags', column_name: 'post_id' },
            { table_name: 'post_tags', column_name: 'tag_id' },
          ]),
        )
        // unique constraints
        .mockResolvedValueOnce(pgResult([]))
        // enums
        .mockResolvedValueOnce(pgResult([]));

      // Act
      const schema = await introspectSchema(mockClient as never);

      // Assert
      const users = schema.tables.find((t) => t.name === 'users')!;
      expect(users.primaryKey).toEqual(['id']);

      const postTags = schema.tables.find((t) => t.name === 'post_tags')!;
      expect(postTags.primaryKey).toEqual(['post_id', 'tag_id']);
    });

    it('should extract unique constraints', async () => {
      // Arrange
      mockClient.query
        // tables
        .mockResolvedValueOnce(pgResult([{ table_name: 'users' }]))
        // columns (bulk)
        .mockResolvedValueOnce(
          pgResult([
            { table_name: 'users', column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
            { table_name: 'users', column_name: 'email', data_type: 'text', is_nullable: 'NO', column_default: null },
            { table_name: 'users', column_name: 'name', data_type: 'text', is_nullable: 'NO', column_default: null },
          ]),
        )
        // foreign keys
        .mockResolvedValueOnce(pgResult([]))
        // primary keys
        .mockResolvedValueOnce(pgResult([{ table_name: 'users', column_name: 'id' }]))
        // unique constraints
        .mockResolvedValueOnce(
          pgResult([
            { table_name: 'users', column_name: 'email' },
          ]),
        )
        // enums
        .mockResolvedValueOnce(pgResult([]));

      // Act
      const schema = await introspectSchema(mockClient as never);

      // Assert
      const users = schema.tables[0]!;
      const emailCol = users.columns.find((c) => c.name === 'email')!;
      expect(emailCol.isUnique).toBe(true);

      const nameCol = users.columns.find((c) => c.name === 'name')!;
      expect(nameCol.isUnique).toBe(false);
    });

    it('should extract custom enum types and their values', async () => {
      // Arrange
      mockClient.query
        // tables
        .mockResolvedValueOnce(pgResult([{ table_name: 'users' }]))
        // columns (bulk)
        .mockResolvedValueOnce(
          pgResult([
            { table_name: 'users', column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
            { table_name: 'users', column_name: 'status', data_type: 'USER-DEFINED', is_nullable: 'NO', column_default: "'active'" },
          ]),
        )
        // foreign keys
        .mockResolvedValueOnce(pgResult([]))
        // primary keys
        .mockResolvedValueOnce(pgResult([]))
        // unique constraints
        .mockResolvedValueOnce(pgResult([]))
        // enums
        .mockResolvedValueOnce(
          pgResult([
            { typname: 'user_status', enumlabel: 'active' },
            { typname: 'user_status', enumlabel: 'inactive' },
            { typname: 'user_status', enumlabel: 'banned' },
          ]),
        )
        // enum column mapping — which columns use which enum type
        .mockResolvedValueOnce(
          pgResult([
            { table_name: 'users', column_name: 'status', udt_name: 'user_status' },
          ]),
        );

      // Act
      const schema = await introspectSchema(mockClient as never);

      // Assert
      const users = schema.tables[0]!;
      const statusCol = users.columns.find((c) => c.name === 'status')!;
      expect(statusCol.isEnum).toBe(true);
      expect(statusCol.enumValues).toEqual(['active', 'inactive', 'banned']);
    });
  });
});
