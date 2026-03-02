# Feature: SupaMock

## Overview

SupaMock is a CLI + Express server that connects to any Postgres database via its connection string, introspects the schema, and serves PostgREST-compatible mock API endpoints with realistic fake data. Developers swap their Supabase URL and their existing `supabase-js` client code works unchanged.

## Actors

| Actor | Description |
|-------|-------------|
| Frontend Developer | Building UI against Supabase, needs mock data during local dev |
| QA Engineer | Running automated tests in CI/CD, needs deterministic mock endpoints |
| Prototyper | Demoing a UI before the real backend is ready |

## User Stories

### US-001: Schema Introspection
**As a** developer
**I want to** point SupaMock at my Postgres connection string
**So that** it automatically discovers my database schema without any manual configuration

**Priority:** Must
**Estimate:** Large

#### Acceptance Criteria

**AC-001.1: Table Discovery**
- Given a valid Postgres connection string
- When SupaMock connects and introspects
- Then it discovers all tables in the specified schema

**AC-001.2: Column Extraction**
- Given a database with tables
- When SupaMock introspects
- Then it extracts each column's name, type, nullability, and default value

**AC-001.3: Foreign Key Mapping**
- Given tables with foreign key relationships
- When SupaMock introspects
- Then it maps all FK constraints including source column, target table, and target column

**AC-001.4: Enum Type Discovery**
- Given custom enum types in the database
- When SupaMock introspects
- Then it extracts all enum types and their valid values

**AC-001.5: Constraint Extraction**
- Given tables with CHECK constraints, unique constraints, and primary keys
- When SupaMock introspects
- Then it extracts all constraints for use in data generation

**AC-001.6: Schema Filtering**
- Given a `--schema` flag with value `custom_schema`
- When SupaMock introspects
- Then it only discovers tables in that schema (default: `public`)

---

### US-002: Realistic Data Generation
**As a** developer
**I want** mock data that looks realistic and matches my schema
**So that** my UI renders correctly and edge cases are naturally covered

**Priority:** Must
**Estimate:** Large

#### Acceptance Criteria

**AC-002.1: Type-Correct Values**
- Given a column of type `integer`
- When mock data is generated
- Then the value is a valid integer (not a string or null unless nullable)

**AC-002.2: Name-Aware Generation**
- Given a column named `email`
- When mock data is generated
- Then the value is a realistic email address (e.g., `jane.doe@example.com`)

**AC-002.3: Enum Compliance**
- Given a column with enum type `status` having values `['active', 'inactive', 'banned']`
- When mock data is generated
- Then the value is one of the valid enum values

**AC-002.4: NOT NULL Enforcement**
- Given a column marked NOT NULL
- When mock data is generated
- Then the value is never null

**AC-002.5: Unique Value Generation**
- Given a column with a unique constraint
- When mock data is generated for multiple rows
- Then all values for that column are distinct

**AC-002.6: FK Referential Integrity**
- Given `posts.user_id` references `users.id`
- When mock data is generated
- Then every `posts.user_id` value exists in the generated `users.id` set

**AC-002.7: Dependency-Ordered Generation**
- Given tables with FK dependencies
- When mock data is generated
- Then parent tables are generated before child tables (topological sort)

**AC-002.8: Circular FK Handling**
- Given tables with circular FK references
- When mock data is generated
- Then cycles are broken by setting nullable FK columns to null, with a warning logged

---

### US-003: Deterministic Seeding
**As a** QA engineer
**I want** the same mock data every time I run SupaMock
**So that** my test assertions are stable and reproducible

**Priority:** Must
**Estimate:** Small

#### Acceptance Criteria

**AC-003.1: Default Determinism**
- Given SupaMock starts with no `--seed` flag
- When data is generated for a table
- Then the same rows are produced on every run

**AC-003.2: Global Seed Override**
- Given `--seed 42` is passed
- When data is generated
- Then all tables use seed 42 as the base, producing different data than the default seed

**AC-003.3: Per-Request Randomization**
- Given a request with `?seed=random`
- When the response is generated
- Then fresh random data is returned (not the seeded default)

---

### US-004: PostgREST-Compatible API
**As a** frontend developer using `supabase-js`
**I want** SupaMock to speak the same API as PostgREST
**So that** I swap the URL and my existing client code works unchanged

**Priority:** Must
**Estimate:** Large

#### Acceptance Criteria

**AC-004.1: Column Selection**
- Given `GET /users?select=id,email`
- When the request is processed
- Then only `id` and `email` fields are returned per row

**AC-004.2: Equality Filter**
- Given `GET /users?status=eq.active`
- When the request is processed
- Then only rows where `status` equals `active` are returned

**AC-004.3: Comparison Operators**
- Given `GET /products?price=gt.10&price=lt.100`
- When the request is processed
- Then only rows where `price` is between 10 and 100 (exclusive) are returned

**AC-004.4: IN Operator**
- Given `GET /users?role=in.(admin,editor)`
- When the request is processed
- Then only rows where `role` is `admin` or `editor` are returned

**AC-004.5: LIKE/ILIKE Operators**
- Given `GET /users?name=ilike.*john*`
- When the request is processed
- Then only rows where `name` contains "john" (case-insensitive) are returned

**AC-004.6: IS Operator**
- Given `GET /users?deleted_at=is.null`
- When the request is processed
- Then only rows where `deleted_at` is null are returned

**AC-004.7: Ordering**
- Given `GET /users?order=created_at.desc`
- When the request is processed
- Then rows are sorted by `created_at` in descending order

**AC-004.8: Pagination**
- Given `GET /users?limit=5&offset=10`
- When the request is processed
- Then 5 rows are returned starting from the 11th row

**AC-004.9: Exact Count**
- Given `GET /users` with header `Prefer: count=exact`
- When the request is processed
- Then the response includes a `Content-Range` header with total count

**AC-004.10: Embedded Relations**
- Given `GET /posts?select=*,users(*)`
- When the request is processed
- Then each post includes its related user object nested under `users`

**AC-004.11: Write Response Shaping**
- Given `POST /users` with a JSON body
- When the request is processed
- Then a PostgREST-shaped success response is returned (status 201, echoed data)

**AC-004.12: PATCH Response Shaping**
- Given `PATCH /users?id=eq.1` with a JSON body
- When the request is processed
- Then a PostgREST-shaped success response is returned (status 200)

**AC-004.13: DELETE Response Shaping**
- Given `DELETE /users?id=eq.1`
- When the request is processed
- Then a PostgREST-shaped success response is returned (status 200)

---

### US-005: CLI Experience
**As a** developer
**I want** a simple CLI that connects and starts with one command
**So that** I spend zero time on configuration

**Priority:** Must
**Estimate:** Medium

#### Acceptance Criteria

**AC-005.1: Minimal Startup**
- Given a valid `--db` connection string
- When `supamock --db <conn>` is run
- Then the server starts with all defaults (port 3210, 20 rows, public schema)

**AC-005.2: Port Configuration**
- Given `--port 8080`
- When SupaMock starts
- Then the server listens on port 8080

**AC-005.3: Row Count Configuration**
- Given `--rows 50`
- When SupaMock generates data
- Then 50 rows are generated per table by default

**AC-005.4: Table Filtering**
- Given `--tables users,posts`
- When SupaMock introspects
- Then only `users` and `posts` tables are mocked (others ignored)

**AC-005.5: Startup Summary**
- Given SupaMock starts successfully
- When introspection completes
- Then a summary table is printed showing each table's name, column count, FK count, and row count

**AC-005.6: Verbose Mode**
- Given `--verbose` flag
- When SupaMock runs
- Then detailed logging is printed (queries, generation steps, warnings)

---

### US-006: Error Handling
**As a** developer
**I want** clear error messages when something goes wrong
**So that** I can quickly diagnose and fix the issue

**Priority:** Should
**Estimate:** Small

#### Acceptance Criteria

**AC-006.1: Bad Connection String**
- Given an invalid or unreachable connection string
- When SupaMock tries to connect
- Then it exits with error: "Could not connect to database. Check your connection string."

**AC-006.2: No Tables Found**
- Given a schema with no tables
- When SupaMock introspects
- Then it warns: "No tables found in schema 'public'. Try --schema to specify a different schema."

**AC-006.3: Unsupported Column Types**
- Given a column with an unsupported type
- When mock data is generated
- Then the value falls back to `null` and a warning is logged in verbose mode

**AC-006.4: Unknown Table Request**
- Given `GET /nonexistent_table`
- When the request is processed
- Then a 404 response is returned with a PostgREST-compatible error body

---

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Table with no columns besides PK | Generate rows with only the PK |
| Column with no matching name heuristic | Fall back to type-based generation |
| Very long table/column names | Handle without truncation |
| Reserved SQL keywords as table names | Handle via proper quoting in introspection |
| Schema with 100+ tables | Generate all tables, may take a few seconds |
| Empty enum type (no values) | Set column to null, log warning |
| Composite primary keys | Support as row identifier |
| Self-referencing FK (e.g., `parent_id` on `categories`) | Treat as circular, break with null for first rows |
| Multiple FKs to same table | Each FK independently references valid IDs |
| `?limit=0` | Return empty array |
| `?offset` beyond row count | Return empty array |
| `?select=nonexistent_column` | Return 400 error |

## Non-Functional Requirements

### Performance
- Schema introspection completes in < 5 seconds for schemas up to 100 tables
- Mock data generation completes in < 3 seconds for 20 rows per table, 100 tables
- API response time < 50ms for filtered queries against in-memory store

### Compatibility
- Works with any Postgres 12+ database (not just Supabase)
- PostgREST response format compatible with `supabase-js` v2

### Reliability
- Graceful shutdown on SIGINT/SIGTERM
- No data corruption in in-memory store under concurrent reads

## Out of Scope

- Persistent writes / in-memory CRUD
- Snapshot/offline mode
- Supabase Auth mocking (auth.users, JWT)
- Supabase Realtime mocking (websockets)
- Supabase Storage mocking
- Row Level Security (RLS) simulation
- Custom seed data files
- Docker image

## Dependencies

- Postgres database accessible via connection string
- Node.js 18+ runtime

## Traceability Matrix

| Requirement | User Story | Component |
|-------------|-----------|-----------|
| Schema Introspection | US-001 | Schema Introspector |
| Data Generation | US-002 | Data Generator, Column Name Mapper |
| Deterministic Seeding | US-003 | Data Generator |
| PostgREST API | US-004 | PostgREST Router, Query Parser, Response Formatter |
| CLI Experience | US-005 | CLI Entry Point |
| Error Handling | US-006 | All components |

## Last Updated: 2026-03-02 by /oss:requirements
