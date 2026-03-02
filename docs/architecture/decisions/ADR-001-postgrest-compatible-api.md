# ADR-001: PostgREST-Compatible API Surface

**Date:** 2026-03-02
**Status:** Accepted
**Deciders:** Project Owner

## Context

SupaMock needs to serve mock API endpoints for Supabase projects. The key question is whether to implement PostgREST's query language (the protocol Supabase uses) or a simpler custom REST convention.

## Research

| Option | Pros | Cons | Fit |
|--------|------|------|-----|
| Full PostgREST compat | supabase-js works unchanged, zero migration, drop-in replacement | Complex parser, large surface area | Best |
| Simple REST (`/mock/users`) | Easy to build, simple API | Requires client code changes, no supabase-js compat | Poor |
| Both (PostgREST + simple alias) | Flexibility | Two APIs to maintain, confusion | Decent |

## Decision

Implement full PostgREST-compatible query syntax including `select`, `order`, `limit`, `offset`, all filter operators (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `in`, `is`), embedded relations, `Prefer` headers, and `Content-Range` headers.

## Consequences

### Positive
- Developers swap the Supabase URL and everything works — the killer feature
- No changes needed to existing `supabase-js` client code
- Works for local dev, CI/CD, and prototyping equally well

### Negative
- PostgREST query parsing is non-trivial (especially embedded relations)
- Large test surface to cover all operators
- Must track PostgREST spec changes over time

### Neutral
- Need to study PostgREST source/docs carefully for edge cases
- Response format must exactly match PostgREST (arrays, headers, error shapes)

## Alternatives Considered

### Alternative 1: Simple REST Convention
- Custom `GET /mock/users`, `GET /mock/users/:id` endpoints
- Rejected: Defeats the core value prop — supabase-js compatibility

### Alternative 2: Proxy Mode
- Proxy real Supabase requests, intercept and return fake data
- Rejected: More complex, requires real Supabase URL, network dependency
