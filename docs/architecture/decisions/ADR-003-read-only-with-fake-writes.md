# ADR-003: Read-Only Store with Fake Write Responses

**Date:** 2026-03-02
**Status:** Accepted
**Deciders:** Project Owner

## Context

SupaMock needs to handle POST/PATCH/DELETE requests from `supabase-js` clients. The question is whether writes should persist in memory or just return success responses.

## Research

| Option | Pros | Cons | Fit |
|--------|------|------|-----|
| Read-only + fake writes | Simple, predictable, deterministic | Can't test write-then-read flows | Best |
| In-memory CRUD | Full CRUD prototyping, realistic | State management, concurrency, reset logic | Decent |
| Read-only, error on writes | Simplest | Breaks client code that does mutations | Poor |

## Decision

The mock data store is read-only. Write operations (POST, PATCH, DELETE) return PostgREST-shaped success responses with realistic data, but do not mutate the in-memory store. Subsequent GETs return the original seeded data.

## Consequences

### Positive
- Deterministic: every GET always returns the same data
- No state management complexity (concurrency, reset, persistence)
- Client code doesn't break — writes "succeed" silently
- Simpler to test

### Negative
- Cannot test write-then-read flows (POST a user, then GET to verify)
- Less realistic for full integration testing

### Neutral
- POST responses echo back the sent body merged with generated defaults (id, timestamps)
- Architecture allows adding in-memory writes later

## Alternatives Considered

### Alternative 1: In-Memory CRUD
- Full read/write against in-memory store, reset on restart
- Rejected for v1: Significant complexity (conflict handling, RETURNING, serial IDs)

### Alternative 2: Error on Writes
- Return 405 Method Not Allowed for POST/PATCH/DELETE
- Rejected: Breaks supabase-js clients that do mutations
