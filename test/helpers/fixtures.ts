/**
 * Shared test fixtures for SupaMock acceptance and integration tests.
 *
 * Provides a hardcoded schema definition with 3 related tables,
 * pre-built mock rows with valid FK references, and a factory
 * function for creating a test Express app.
 */

import type { Express } from 'express';
import type {
  SchemaDefinition,
  TableInfo,
  ColumnInfo,
  ForeignKey,
  MockRow,
} from '../../src/types.js';
import { MockStore } from '../../src/store/mock-store.js';
import { createApp } from '../../src/server/server.js';

// ---------------------------------------------------------------------------
// FIXTURE_SCHEMA
// ---------------------------------------------------------------------------

const usersColumns: ColumnInfo[] = [
  {
    name: 'id',
    type: 'uuid',
    nullable: false,
    defaultValue: 'gen_random_uuid()',
    isEnum: false,
    enumValues: [],
    isUnique: true,
  },
  {
    name: 'email',
    type: 'text',
    nullable: false,
    defaultValue: null,
    isEnum: false,
    enumValues: [],
    isUnique: true,
  },
  {
    name: 'name',
    type: 'text',
    nullable: false,
    defaultValue: null,
    isEnum: false,
    enumValues: [],
    isUnique: false,
  },
  {
    name: 'status',
    type: 'text',
    nullable: false,
    defaultValue: "'active'",
    isEnum: true,
    enumValues: ['active', 'inactive', 'banned'],
    isUnique: false,
  },
  {
    name: 'created_at',
    type: 'timestamptz',
    nullable: false,
    defaultValue: 'now()',
    isEnum: false,
    enumValues: [],
    isUnique: false,
  },
];

const postsColumns: ColumnInfo[] = [
  {
    name: 'id',
    type: 'integer',
    nullable: false,
    defaultValue: "nextval('posts_id_seq')",
    isEnum: false,
    enumValues: [],
    isUnique: true,
  },
  {
    name: 'title',
    type: 'text',
    nullable: false,
    defaultValue: null,
    isEnum: false,
    enumValues: [],
    isUnique: false,
  },
  {
    name: 'body',
    type: 'text',
    nullable: true,
    defaultValue: null,
    isEnum: false,
    enumValues: [],
    isUnique: false,
  },
  {
    name: 'user_id',
    type: 'uuid',
    nullable: false,
    defaultValue: null,
    isEnum: false,
    enumValues: [],
    isUnique: false,
  },
  {
    name: 'created_at',
    type: 'timestamptz',
    nullable: false,
    defaultValue: 'now()',
    isEnum: false,
    enumValues: [],
    isUnique: false,
  },
];

const commentsColumns: ColumnInfo[] = [
  {
    name: 'id',
    type: 'integer',
    nullable: false,
    defaultValue: "nextval('comments_id_seq')",
    isEnum: false,
    enumValues: [],
    isUnique: true,
  },
  {
    name: 'body',
    type: 'text',
    nullable: false,
    defaultValue: null,
    isEnum: false,
    enumValues: [],
    isUnique: false,
  },
  {
    name: 'post_id',
    type: 'integer',
    nullable: false,
    defaultValue: null,
    isEnum: false,
    enumValues: [],
    isUnique: false,
  },
  {
    name: 'user_id',
    type: 'uuid',
    nullable: false,
    defaultValue: null,
    isEnum: false,
    enumValues: [],
    isUnique: false,
  },
];

const postsForeignKeys: ForeignKey[] = [
  {
    column: 'user_id',
    referencedTable: 'users',
    referencedColumn: 'id',
  },
];

const commentsForeignKeys: ForeignKey[] = [
  {
    column: 'post_id',
    referencedTable: 'posts',
    referencedColumn: 'id',
  },
  {
    column: 'user_id',
    referencedTable: 'users',
    referencedColumn: 'id',
  },
];

const usersTable: TableInfo = {
  name: 'users',
  columns: usersColumns,
  primaryKey: ['id'],
  foreignKeys: [],
};

const postsTable: TableInfo = {
  name: 'posts',
  columns: postsColumns,
  primaryKey: ['id'],
  foreignKeys: postsForeignKeys,
};

const commentsTable: TableInfo = {
  name: 'comments',
  columns: commentsColumns,
  primaryKey: ['id'],
  foreignKeys: commentsForeignKeys,
};

/**
 * A hardcoded SchemaDefinition with 3 related tables:
 * - users (id uuid PK, email text, name text, status enum, created_at timestamptz)
 * - posts (id integer PK, title text, body text, user_id uuid FK->users.id, created_at timestamptz)
 * - comments (id integer PK, body text, post_id integer FK->posts.id, user_id uuid FK->users.id)
 */
export const FIXTURE_SCHEMA: SchemaDefinition = {
  tables: [usersTable, postsTable, commentsTable],
};

// ---------------------------------------------------------------------------
// FIXTURE_ROWS
// ---------------------------------------------------------------------------

const userIds = [
  'a1b2c3d4-0001-4000-8000-000000000001',
  'a1b2c3d4-0002-4000-8000-000000000002',
  'a1b2c3d4-0003-4000-8000-000000000003',
  'a1b2c3d4-0004-4000-8000-000000000004',
  'a1b2c3d4-0005-4000-8000-000000000005',
] as const;

const fixtureUsers: MockRow[] = [
  {
    id: userIds[0],
    email: 'alice@example.com',
    name: 'Alice Johnson',
    status: 'active',
    created_at: '2026-01-15T10:30:00.000Z',
  },
  {
    id: userIds[1],
    email: 'bob@example.com',
    name: 'Bob Smith',
    status: 'active',
    created_at: '2026-01-16T11:00:00.000Z',
  },
  {
    id: userIds[2],
    email: 'carol@example.com',
    name: 'Carol Davis',
    status: 'inactive',
    created_at: '2026-01-17T09:15:00.000Z',
  },
  {
    id: userIds[3],
    email: 'dave@example.com',
    name: 'Dave Wilson',
    status: 'active',
    created_at: '2026-01-18T14:45:00.000Z',
  },
  {
    id: userIds[4],
    email: 'eve@example.com',
    name: 'Eve Martinez',
    status: 'banned',
    created_at: '2026-01-19T08:00:00.000Z',
  },
];

const fixturePosts: MockRow[] = [
  { id: 1, title: 'Getting Started with Supabase', body: 'A comprehensive guide to setting up your first project.', user_id: userIds[0], created_at: '2026-02-01T10:00:00.000Z' },
  { id: 2, title: 'Advanced PostgreSQL Tips', body: 'Deep dive into indexing and query optimization.', user_id: userIds[0], created_at: '2026-02-02T11:00:00.000Z' },
  { id: 3, title: 'Building REST APIs', body: 'How to design clean and maintainable REST endpoints.', user_id: userIds[1], created_at: '2026-02-03T12:00:00.000Z' },
  { id: 4, title: 'TypeScript Best Practices', body: 'Tips for writing type-safe applications.', user_id: userIds[1], created_at: '2026-02-04T13:00:00.000Z' },
  { id: 5, title: 'Testing with Vitest', body: 'A practical guide to modern testing with Vitest.', user_id: userIds[2], created_at: '2026-02-05T14:00:00.000Z' },
  { id: 6, title: 'Docker for Developers', body: 'Containerize your development workflow.', user_id: userIds[2], created_at: '2026-02-06T15:00:00.000Z' },
  { id: 7, title: 'CI/CD Pipeline Design', body: 'Automate your deployment process effectively.', user_id: userIds[3], created_at: '2026-02-07T16:00:00.000Z' },
  { id: 8, title: 'React Server Components', body: 'Understanding the new React paradigm.', user_id: userIds[3], created_at: '2026-02-08T17:00:00.000Z' },
  { id: 9, title: 'Database Migrations', body: 'Managing schema changes safely in production.', user_id: userIds[4], created_at: '2026-02-09T18:00:00.000Z' },
  { id: 10, title: 'Monitoring in Production', body: 'Observability patterns for modern applications.', user_id: userIds[4], created_at: '2026-02-10T19:00:00.000Z' },
];

const fixtureComments: MockRow[] = [
  { id: 1, body: 'Great article, very helpful!', post_id: 1, user_id: userIds[1] },
  { id: 2, body: 'Thanks for the detailed explanation.', post_id: 1, user_id: userIds[2] },
  { id: 3, body: 'I had the same issue, this solved it.', post_id: 2, user_id: userIds[3] },
  { id: 4, body: 'Could you elaborate on indexing strategies?', post_id: 2, user_id: userIds[4] },
  { id: 5, body: 'Clean architecture is key.', post_id: 3, user_id: userIds[0] },
  { id: 6, body: 'I prefer GraphQL for this use case.', post_id: 3, user_id: userIds[4] },
  { id: 7, body: 'Strict mode all the way!', post_id: 4, user_id: userIds[0] },
  { id: 8, body: 'What about runtime validation?', post_id: 4, user_id: userIds[2] },
  { id: 9, body: 'Vitest is so much faster than Jest.', post_id: 5, user_id: userIds[3] },
  { id: 10, body: 'Great comparison with other frameworks.', post_id: 6, user_id: userIds[0] },
  { id: 11, body: 'Docker compose makes this even easier.', post_id: 6, user_id: userIds[1] },
  { id: 12, body: 'GitHub Actions works great for this.', post_id: 7, user_id: userIds[4] },
  { id: 13, body: 'Interesting perspective on RSC.', post_id: 8, user_id: userIds[2] },
  { id: 14, body: 'We use Flyway for migrations.', post_id: 9, user_id: userIds[1] },
  { id: 15, body: 'Prometheus + Grafana is our stack.', post_id: 10, user_id: userIds[3] },
];

/**
 * Pre-built mock rows for each fixture table.
 * - 5 users with distinct statuses (3 active, 1 inactive, 1 banned)
 * - 10 posts with valid user_id FK references (2 per user)
 * - 15 comments with valid post_id and user_id FK references
 */
export const FIXTURE_ROWS: Record<string, MockRow[]> = {
  users: fixtureUsers,
  posts: fixturePosts,
  comments: fixtureComments,
};

// ---------------------------------------------------------------------------
// createTestApp
// ---------------------------------------------------------------------------

/**
 * Creates an Express app configured with fixture schema and data for testing.
 *
 * This function will be implemented during the build phase. It should:
 * 1. Create a MockStore seeded with FIXTURE_ROWS
 * 2. Create a PostgREST router using FIXTURE_SCHEMA
 * 3. Wire them into an Express app with JSON parsing and CORS
 * 4. Return the app (no listening — supertest handles that)
 *
 * @param options - Optional overrides for schema and rows
 * @returns Express application ready for supertest
 */
export async function createTestApp(options?: {
  schema?: SchemaDefinition;
  rows?: Record<string, MockRow[]>;
}): Promise<Express> {
  const schema = options?.schema ?? FIXTURE_SCHEMA;
  const rows = options?.rows ?? FIXTURE_ROWS;

  const store = new MockStore(schema);
  store.seedFromData(rows);

  return createApp(store);
}
