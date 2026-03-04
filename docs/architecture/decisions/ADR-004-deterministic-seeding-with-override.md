# ADR-004: Deterministic Seeding by Default with Override

**Date:** 2026-03-02
**Status:** Accepted
**Deciders:** Project Owner

## Context

Mock data can be generated randomly or deterministically. For testing and CI/CD, deterministic data is critical. For demos and exploration, random data is useful.

## Research

| Option | Pros | Cons | Fit |
|--------|------|------|-----|
| Deterministic default + random override | Stable tests, fresh on demand | Slightly more complex seed logic | Best |
| Always random | Fresh data, realistic | Breaks test assertions, flaky CI | Poor |
| Always deterministic | Predictable, simple | Boring for demos, no variety | Decent |

## Decision

Default to deterministic seeding derived from table name (`hash(tableName)`). Global seed overridable via `--seed <number>` CLI flag. Per-request randomization via `?seed=random` query param.

## Consequences

### Positive
- Tests can assert against specific values — no flakiness
- Same data across machines/CI runs for same schema
- On-demand freshness for demos via `?seed=random`

### Negative
- Developers may be confused when data doesn't change between restarts
- Need clear documentation about seeding behavior

### Neutral
- Each table gets its own derived seed for isolation
- `--seed` flag shifts all table seeds uniformly
