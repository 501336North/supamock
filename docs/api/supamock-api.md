# SupaMock API Contract

## Overview

SupaMock serves PostgREST-compatible endpoints dynamically based on the introspected database schema. Every table in the schema becomes an endpoint.

## Consumer

| Consumer | Protocol | Notes |
|----------|----------|-------|
| `supabase-js` client | HTTP/JSON | Primary consumer — must be fully compatible |
| Any HTTP client | HTTP/JSON | curl, Postman, fetch, etc. |
| CI/CD test runners | HTTP/JSON | Deterministic responses for assertions |

## Dynamic Routing

For every table `{table}` in the introspected schema:

```
GET    /{table}              # List rows (with filtering, ordering, pagination)
GET    /{table}?select=...   # Select specific columns and/or embed relations
POST   /{table}              # Fake create (returns shaped success response)
PATCH  /{table}?{filters}    # Fake update (returns shaped success response)
DELETE /{table}?{filters}    # Fake delete (returns shaped success response)
```

## Query Parameters (PostgREST-Compatible)

### Column Selection

```
GET /users?select=id,email,created_at
GET /posts?select=id,title,users(id,email)    # Embedded relation
GET /posts?select=*,users(*)                   # All columns + all user columns
```

**Response shape:** Only selected columns are included in the response objects.

### Filtering

| Operator | Example | Meaning |
|----------|---------|---------|
| `eq` | `?status=eq.active` | Equals |
| `neq` | `?status=neq.banned` | Not equals |
| `gt` | `?age=gt.18` | Greater than |
| `gte` | `?age=gte.18` | Greater than or equal |
| `lt` | `?price=lt.100` | Less than |
| `lte` | `?price=lte.100` | Less than or equal |
| `like` | `?name=like.*john*` | Pattern match (case-sensitive) |
| `ilike` | `?name=ilike.*john*` | Pattern match (case-insensitive) |
| `in` | `?role=in.(admin,editor)` | In set |
| `is` | `?deleted_at=is.null` | Is null / is not null |

Multiple filters on different columns are ANDed:
```
GET /users?status=eq.active&age=gt.18
```

### Ordering

```
GET /users?order=created_at.desc
GET /users?order=last_name.asc,first_name.asc    # Multiple columns
```

### Pagination

```
GET /users?limit=10&offset=20
```

### Count

Request header: `Prefer: count=exact`

Response header: `Content-Range: 0-19/156`

## Request/Response Schemas

### GET (List) — Success (200)

```
GET /users?select=id,email&limit=2

Response: 200 OK
Content-Type: application/json
Content-Range: 0-1/20

[
  { "id": "a1b2c3d4-...", "email": "jane.doe@example.com" },
  { "id": "e5f6g7h8-...", "email": "bob.smith@example.net" }
]
```

**Notes:**
- Response is always a JSON array (even for 0 results)
- `Content-Range` header only included when `Prefer: count=exact` is sent

### GET (List) with Embedded Relations — Success (200)

```
GET /posts?select=id,title,users(id,email)

Response: 200 OK

[
  {
    "id": 1,
    "title": "Hello World",
    "users": { "id": "a1b2c3d4-...", "email": "jane.doe@example.com" }
  }
]
```

**Notes:**
- Embedded relations are nested objects (single) or arrays (many) depending on FK direction
- FK from `posts.user_id` -> `users.id` embeds as single object under `users`

### POST (Create) — Fake Success (201)

```
POST /users
Content-Type: application/json
Prefer: return=representation

{ "email": "new@example.com", "name": "New User" }

Response: 201 Created
Content-Type: application/json

[
  {
    "id": "generated-uuid",
    "email": "new@example.com",
    "name": "New User",
    "created_at": "2026-03-02T00:00:00Z"
  }
]
```

**Notes:**
- Response echoes back the sent body merged with generated defaults (id, timestamps)
- Data is NOT persisted — subsequent GETs return the original seeded data
- Response is always a JSON array (PostgREST convention)

### PATCH (Update) — Fake Success (200)

```
PATCH /users?id=eq.a1b2c3d4
Content-Type: application/json
Prefer: return=representation

{ "name": "Updated Name" }

Response: 200 OK
Content-Type: application/json

[
  {
    "id": "a1b2c3d4-...",
    "email": "jane.doe@example.com",
    "name": "Updated Name",
    "created_at": "2026-01-15T10:30:00Z"
  }
]
```

**Notes:**
- Response shows the "matching" row with the patched fields merged in
- Data is NOT persisted

### DELETE — Fake Success (200)

```
DELETE /users?id=eq.a1b2c3d4

Response: 200 OK
Content-Type: application/json

[]
```

**Notes:**
- Returns empty array or the deleted row(s) if `Prefer: return=representation`
- Data is NOT actually deleted

## Error Responses

All errors follow PostgREST error format:

```json
{
  "message": "Descriptive error message",
  "code": "PGRST_CODE",
  "details": "Additional context",
  "hint": "Suggestion for fix"
}
```

### Error Codes

| Status | Code | When |
|--------|------|------|
| 400 | `PGRST102` | Invalid query parameter or filter syntax |
| 404 | `PGRST200` | Table not found in schema |
| 406 | `PGRST107` | Unsupported `Accept` header |
| 416 | `PGRST103` | Range not satisfiable (offset beyond total) |

### Examples

**Unknown table:**
```
GET /nonexistent

Response: 404
{
  "message": "Relation 'nonexistent' not found",
  "code": "PGRST200",
  "details": null,
  "hint": "Available tables: users, posts, comments"
}
```

**Invalid filter syntax:**
```
GET /users?age=badop.5

Response: 400
{
  "message": "Invalid operator 'badop'",
  "code": "PGRST102",
  "details": "Column 'age' filter has unknown operator",
  "hint": "Valid operators: eq, neq, gt, gte, lt, lte, like, ilike, in, is"
}
```

**Unknown column in select:**
```
GET /users?select=id,nonexistent

Response: 400
{
  "message": "Column 'nonexistent' not found in 'users'",
  "code": "PGRST102",
  "details": null,
  "hint": "Available columns: id, email, name, created_at"
}
```

## Request Headers

| Header | Effect |
|--------|--------|
| `Prefer: count=exact` | Include `Content-Range` header with total row count |
| `Prefer: return=representation` | Return the affected row(s) in write responses |
| `Prefer: return=minimal` | Return empty body on writes |
| `Content-Type: application/json` | Required for POST/PATCH bodies |

## Response Headers

| Header | When | Example |
|--------|------|---------|
| `Content-Type` | Always | `application/json` |
| `Content-Range` | When `Prefer: count=exact` | `0-19/156` |
| `X-SupaMock` | Always | `true` (identifies this as mock server) |

## TypeScript Types

```typescript
/** PostgREST filter operators */
type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is';

/** Sort direction */
type SortDirection = 'asc' | 'desc';

/** Parsed query from PostgREST URL */
interface PostgRESTQuery {
  select: SelectClause;
  filters: Filter[];
  order: OrderClause[];
  limit: number;
  offset: number;
  prefer: PreferHeader;
}

/** Column selection, possibly with embedded relations */
interface SelectClause {
  columns: string[] | '*';
  embeds: EmbedClause[];
}

/** Embedded relation in select */
interface EmbedClause {
  relation: string;
  columns: string[] | '*';
}

/** A single filter condition */
interface Filter {
  column: string;
  operator: FilterOperator;
  value: string | string[] | null;
}

/** Order by clause */
interface OrderClause {
  column: string;
  direction: SortDirection;
}

/** Parsed Prefer header */
interface PreferHeader {
  count?: 'exact';
  return?: 'representation' | 'minimal';
}

/** PostgREST error response */
interface PostgRESTError {
  message: string;
  code: string;
  details: string | null;
  hint: string | null;
}

/** Row of mock data (dynamic based on schema) */
type MockRow = Record<string, unknown>;
```

## Last Updated: 2026-03-02 by /oss:api-design
