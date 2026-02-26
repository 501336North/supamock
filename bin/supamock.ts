#!/usr/bin/env node
import { Command, Option } from 'commander';
import { startServer } from '../src/index.js';

const program = new Command();
program
  .name('supamock')
  .description('Mock API endpoints from your Postgres schema')
  .requiredOption('--db-url <url>', 'PostgreSQL connection string')
  .option('--port <number>', 'Server port', '3210')
  .option('--default-count <number>', 'Default records per request', '10')
  .addOption(
    new Option('--format <format>', 'Response format')
      .choices(['rest', 'supabase'])
      .default('rest')
  )
  .action(async (opts: { dbUrl: string; port: string; defaultCount: string; format: string }) => {
    try {
      const config = {
        dbUrl: opts.dbUrl,
        port: parseInt(opts.port, 10),
        defaultCount: parseInt(opts.defaultCount, 10),
        format: opts.format as 'rest' | 'supabase',
      };
      await startServer(config);
      console.log(`SupaMock running at http://127.0.0.1:${config.port}/mock`);
      console.log('Press Ctrl+C to stop');
    } catch (err) {
      if (err instanceof Error) {
        const sanitized = err.message.replace(/postgresql?:\/\/[^\s]+/gi, 'postgresql://***');
        process.stderr.write(`Error: ${sanitized}\n`);
      }
      process.exit(1);
    }
  });

program.parse();
