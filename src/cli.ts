import { createRequire } from 'node:module';
import { Command } from 'commander';
import { Client } from 'pg';
import { introspectSchema } from './schema/introspector.js';
import { MockStore } from './store/mock-store.js';
import { createApp, startServer, printStartupSummary } from './server/server.js';
import type { SchemaDefinition } from './types.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

export interface CLIConfig {
  db: string;
  port: number;
  seed?: number;
  rows: number;
  tables?: string[];
  schema: string;
}

export function parseArgs(argv: string[]): CLIConfig {
  const program = new Command();

  program
    .name('supamock')
    .description('Mock API server for Postgres databases')
    .version(pkg.version)
    .requiredOption('-d, --db <connection-string>', 'Postgres connection string')
    .option('-p, --port <number>', 'Server port', '3210')
    .option('-s, --seed <number>', 'Global random seed')
    .option('-r, --rows <number>', 'Default rows per table', '20')
    .option('-t, --tables <list>', 'Comma-separated table filter')
    .option('--schema <name>', 'Schema to introspect', 'public');

  program.exitOverride();

  try {
    program.parse(argv);
  } catch {
    throw new Error('Missing required option: --db <connection-string>');
  }

  const opts = program.opts<{
    db: string;
    port: string;
    seed?: string;
    rows: string;
    tables?: string;
    schema: string;
  }>();

  const port = Number(opts.port);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${opts.port}. Must be between 1 and 65535.`);
  }

  const rows = Number(opts.rows);
  if (!Number.isFinite(rows) || rows < 1) {
    throw new Error(`Invalid rows: ${opts.rows}. Must be a positive integer.`);
  }

  const seed = opts.seed !== undefined ? Number(opts.seed) : undefined;
  if (seed !== undefined && !Number.isFinite(seed)) {
    throw new Error(`Invalid seed: ${opts.seed}. Must be a number.`);
  }

  return {
    db: opts.db,
    port,
    seed,
    rows,
    tables: opts.tables?.split(','),
    schema: opts.schema,
  };
}

export async function run(config: CLIConfig): Promise<void> {
  const client = new Client({ connectionString: config.db });

  try {
    await client.connect();
  } catch {
    console.error('Could not connect to database. Check your connection string.');
    process.exit(1);
    return;
  }

  let schema: SchemaDefinition;
  try {
    schema = await introspectSchema(client, config.schema);
  } finally {
    await client.end();
  }

  if (schema.tables.length === 0) {
    console.warn('No tables found in schema. The mock server will have no endpoints.');
    return;
  }

  // Filter tables if --tables flag was provided
  if (config.tables) {
    const allowed = new Set(config.tables);
    schema = {
      tables: schema.tables.filter((t) => allowed.has(t.name)),
    };
  }

  const store = new MockStore(schema);
  store.seed(config.rows, config.seed);

  const app = createApp(store);
  await startServer(app, config.port);
  printStartupSummary(schema, config.rows);
}
