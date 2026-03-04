#!/usr/bin/env node
import { parseArgs, run } from '../cli.js';

const config = parseArgs(process.argv);
run(config).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
