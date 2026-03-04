/**
 * Dependency Graph Builder — Unit Tests
 *
 * @behavior Builds a dependency graph from FK relationships and topologically sorts tables
 * @business-rule Tables referenced by FKs must be populated before the tables that reference them
 *
 * Pure function tests — no mocking needed.
 */

import { describe, it, expect } from 'vitest';
import type { SchemaDefinition } from '../../../src/types.js';
import {
  buildDependencyGraph,
  topologicalSort,
} from '../../../src/schema/dependency-graph.js';
import type {
  DependencyGraph,
  TopologicalResult,
} from '../../../src/schema/dependency-graph.js';

describe('Dependency Graph Builder', () => {
  /**
   * @behavior Parents appear before children in the sorted order
   * @business-rule When posts.user_id references users.id, users must come before posts
   */
  it('should return tables in dependency order (parents before children)', () => {
    // Given: a schema where posts.user_id -> users.id
    const schema: SchemaDefinition = {
      tables: [
        {
          name: 'posts',
          columns: [
            { name: 'id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
            { name: 'user_id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
            { name: 'title', type: 'text', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
          ],
          primaryKey: ['id'],
          foreignKeys: [
            { column: 'user_id', referencedTable: 'users', referencedColumn: 'id' },
          ],
        },
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
            { name: 'email', type: 'text', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
          ],
          primaryKey: ['id'],
          foreignKeys: [],
        },
      ],
    };

    // When: building the dependency graph and sorting
    const graph = buildDependencyGraph(schema);
    const result = topologicalSort(graph);

    // Then: users appears before posts in the sorted order
    const usersIndex = result.sorted.indexOf('users');
    const postsIndex = result.sorted.indexOf('posts');
    expect(usersIndex).toBeLessThan(postsIndex);

    // Then: no cycles are detected
    expect(result.cycles).toEqual([]);

    // Then: both tables are present in the sorted output
    expect(result.sorted).toHaveLength(2);
    expect(result.sorted).toContain('users');
    expect(result.sorted).toContain('posts');
  });

  /**
   * @behavior Standalone tables (no FKs) still appear in the sorted output
   * @business-rule All tables must be represented, even those with no dependencies
   */
  it('should handle tables with no foreign keys', () => {
    // Given: a schema with two independent tables (no FK relationships)
    const schema: SchemaDefinition = {
      tables: [
        {
          name: 'settings',
          columns: [
            { name: 'key', type: 'text', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
            { name: 'value', type: 'text', nullable: true, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
          ],
          primaryKey: ['key'],
          foreignKeys: [],
        },
        {
          name: 'logs',
          columns: [
            { name: 'id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
            { name: 'message', type: 'text', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
          ],
          primaryKey: ['id'],
          foreignKeys: [],
        },
      ],
    };

    // When: building the dependency graph and sorting
    const graph = buildDependencyGraph(schema);
    const result = topologicalSort(graph);

    // Then: both tables appear in the sorted output
    expect(result.sorted).toHaveLength(2);
    expect(result.sorted).toContain('settings');
    expect(result.sorted).toContain('logs');

    // Then: no cycles are detected
    expect(result.cycles).toEqual([]);

    // Then: the graph has no edges
    expect(graph.edges).toEqual([]);
  });

  /**
   * @behavior Circular FK references are detected and reported
   * @business-rule When table A -> B -> A, cycles must be identified so the caller can handle them
   */
  it('should detect circular FK references', () => {
    // Given: a schema where orders -> customers -> orders (circular)
    const schema: SchemaDefinition = {
      tables: [
        {
          name: 'orders',
          columns: [
            { name: 'id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
            { name: 'customer_id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
          ],
          primaryKey: ['id'],
          foreignKeys: [
            { column: 'customer_id', referencedTable: 'customers', referencedColumn: 'id' },
          ],
        },
        {
          name: 'customers',
          columns: [
            { name: 'id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
            { name: 'last_order_id', type: 'uuid', nullable: true, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
          ],
          primaryKey: ['id'],
          foreignKeys: [
            { column: 'last_order_id', referencedTable: 'orders', referencedColumn: 'id' },
          ],
        },
      ],
    };

    // When: building the dependency graph and sorting
    const graph = buildDependencyGraph(schema);
    const result = topologicalSort(graph);

    // Then: cycles are detected
    expect(result.cycles.length).toBeGreaterThan(0);

    // Then: the cycle contains both tables
    const cycleMembers = result.cycles.flat();
    expect(cycleMembers).toContain('orders');
    expect(cycleMembers).toContain('customers');
  });

  /**
   * @behavior Self-referencing FKs are handled gracefully
   * @business-rule A table like categories.parent_id -> categories.id should still appear in sort,
   *               with the self-reference detected as a cycle
   */
  it('should handle self-referencing FKs (e.g., categories.parent_id)', () => {
    // Given: a schema where categories.parent_id references categories.id
    const schema: SchemaDefinition = {
      tables: [
        {
          name: 'categories',
          columns: [
            { name: 'id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
            { name: 'name', type: 'text', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
            { name: 'parent_id', type: 'uuid', nullable: true, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
          ],
          primaryKey: ['id'],
          foreignKeys: [
            { column: 'parent_id', referencedTable: 'categories', referencedColumn: 'id' },
          ],
        },
      ],
    };

    // When: building the dependency graph and sorting
    const graph = buildDependencyGraph(schema);
    const result = topologicalSort(graph);

    // Then: the self-reference is detected as a cycle
    expect(result.cycles.length).toBeGreaterThan(0);
    const cycleMembers = result.cycles.flat();
    expect(cycleMembers).toContain('categories');

    // Then: the graph has an edge from categories to itself
    expect(graph.edges).toContainEqual({ from: 'categories', to: 'categories' });
  });

  /**
   * @behavior Multiple FKs to the same parent table are handled correctly
   * @business-rule When a child table has several FKs pointing to the same parent,
   *               the parent appears once in the sorted output and before the child
   */
  it('should handle multiple FKs to the same table', () => {
    // Given: a schema where messages has both sender_id and recipient_id -> users.id
    const schema: SchemaDefinition = {
      tables: [
        {
          name: 'messages',
          columns: [
            { name: 'id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
            { name: 'sender_id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
            { name: 'recipient_id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
            { name: 'body', type: 'text', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
          ],
          primaryKey: ['id'],
          foreignKeys: [
            { column: 'sender_id', referencedTable: 'users', referencedColumn: 'id' },
            { column: 'recipient_id', referencedTable: 'users', referencedColumn: 'id' },
          ],
        },
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: true },
            { name: 'name', type: 'text', nullable: false, defaultValue: null, isEnum: false, enumValues: [], isUnique: false },
          ],
          primaryKey: ['id'],
          foreignKeys: [],
        },
      ],
    };

    // When: building the dependency graph and sorting
    const graph = buildDependencyGraph(schema);
    const result = topologicalSort(graph);

    // Then: users appears before messages
    const usersIndex = result.sorted.indexOf('users');
    const messagesIndex = result.sorted.indexOf('messages');
    expect(usersIndex).toBeLessThan(messagesIndex);

    // Then: both tables are present exactly once
    expect(result.sorted).toHaveLength(2);
    expect(result.sorted).toContain('users');
    expect(result.sorted).toContain('messages');

    // Then: the graph has two edges from messages to users
    const messagesToUsers = graph.edges.filter(
      (e) => e.from === 'messages' && e.to === 'users',
    );
    expect(messagesToUsers).toHaveLength(2);

    // Then: no cycles
    expect(result.cycles).toEqual([]);
  });
});
