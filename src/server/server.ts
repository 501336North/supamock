import express from 'express';
import cors from 'cors';
import http from 'node:http';
import type { MockStore } from '../store/mock-store.js';
import type { SchemaDefinition } from '../types.js';
import { createRouter } from './router.js';

export function createApp(store: MockStore): express.Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(cors());
  app.use('/', createRouter(store));

  // Global error handler - must have 4 params for Express to recognize it
  app.use((_err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({
      message: 'Internal server error',
      code: 'PGRST500',
      details: null,
      hint: null,
    });
  });

  return app;
}

export function startServer(app: express.Express, port: number, host = '127.0.0.1'): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = app.listen(port, host, () => {
      resolve(server);
    });

    const onSigInt = (): void => { server.close(); };
    const onSigTerm = (): void => { server.close(); };
    process.on('SIGINT', onSigInt);
    process.on('SIGTERM', onSigTerm);

    server.on('close', () => {
      process.removeListener('SIGINT', onSigInt);
      process.removeListener('SIGTERM', onSigTerm);
    });
  });
}

export function printStartupSummary(schema: SchemaDefinition, rowCount: number): void {
  console.log('\n  SupaMock Server');
  console.log('  ───────────────────────────────────────');
  console.log('  Table               Columns  FKs  Rows');
  console.log('  ───────────────────────────────────────');

  for (const table of schema.tables) {
    const name = table.name.padEnd(20);
    const cols = String(table.columns.length).padStart(7);
    const fks = String(table.foreignKeys.length).padStart(4);
    const rows = String(rowCount).padStart(5);
    console.log(`  ${name}${cols}${fks}${rows}`);
  }

  console.log('  ───────────────────────────────────────\n');
}
