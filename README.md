# SupaMock

Point any Postgres database, get instant mock API endpoints with realistic data. Respects types, foreign keys, and constraints. Zero config.

## Quick Start

```bash
npm install supamock
npx supamock -d "postgresql://user:pass@host:5432/dbname"
```

That's it. SupaMock connects to your database, reads the schema, and starts serving mock data.

```
SupaMock Server
───────────────────────────────────────
Table               Columns  FKs  Rows
───────────────────────────────────────
orders                    7   2   20
products                  7   0   20
users                     5   0   20
───────────────────────────────────────
```

## Usage

```bash
# Start with a Supabase database
npx supamock -d "postgresql://postgres:yourpass@db.xyz.supabase.co:5432/postgres"

# Custom port
npx supamock -d "postgresql://..." --port 3001

# Fetch mock data
curl http://localhost:3000/users
curl http://localhost:3000/products
curl http://localhost:3000/orders
```

## What It Does

- Connects to any Postgres database (including Supabase)
- Introspects the schema via `information_schema`
- Generates realistic fake data using Faker.js
- Serves PostgREST-compatible REST endpoints
- Respects column types, foreign keys, and constraints
- Zero writes to your database

## Why

You need mock data for local development. You don't want to hit production. You don't want to write seed scripts. Point SupaMock at your database and get realistic endpoints in seconds.

## Built With

Built in 75 minutes from idea to merged PR using [One Shot Ship](https://www.oneshotship.com), a Claude Code plugin that enforces TDD and structured dev workflows.

Watch the build: [youtube.com/watch?v=k-SjlI-sit0](https://youtu.be/k-SjlI-sit0)

## License

ISC
