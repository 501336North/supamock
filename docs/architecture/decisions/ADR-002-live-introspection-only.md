# ADR-002: Live Schema Introspection Only (No Snapshot Mode)

**Date:** 2026-03-02
**Status:** Accepted
**Deciders:** Project Owner

## Context

SupaMock needs to understand the database schema to generate appropriate mock data. The question is whether to support offline/snapshot mode in addition to live Postgres introspection.

## Research

| Option | Pros | Cons | Fit |
|--------|------|------|-----|
| Live introspection only | Simple, always up-to-date, zero config | Requires DB access at startup | Best |
| Snapshot mode only | Offline, CI-friendly | Can drift from real schema, file management | Poor |
| Both (live + snapshot) | Flexible, CI-friendly | Two code paths, more complexity | Decent |

## Decision

v1 supports live introspection only. SupaMock connects to Postgres at startup, reads `information_schema` and `pg_catalog`, and builds its schema definition in memory. No snapshot files.

## Consequences

### Positive
- Single code path — simpler to build, test, and maintain
- Schema is always current — no drift between snapshot and reality
- Zero config beyond the connection string

### Negative
- Requires network access to Postgres at startup
- CI/CD must have DB connectivity (or use a test database)
- Cannot run fully offline

### Neutral
- Architecture allows adding snapshot mode later without rewrite (introspector returns a SchemaDefinition either way)

## Alternatives Considered

### Alternative 1: Snapshot Mode
- `supamock snapshot --db <conn> > schema.json` then `supamock --schema schema.json`
- Rejected for v1: Adds file management, versioning, staleness concerns

### Alternative 2: Both Modes
- Live by default, `--snapshot` to save, `--from-snapshot` to load
- Rejected for v1: Premature complexity, can add later
