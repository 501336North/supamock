import express from 'express';
import cors from 'cors';
import type { Server } from 'http';
import { createReadOnlyPool, introspect } from './schema-introspector.js';
import { topologicalSort } from './topological-sorter.js';
import { createRouter } from './router.js';
import type { ServerConfig } from './types.js';
import type pg from 'pg';

export interface StartServerResult {
  app: express.Express;
  server: Server;
  close: () => Promise<void>;
}

export async function startServer(config: ServerConfig): Promise<StartServerResult> {
  const pool: pg.Pool = createReadOnlyPool(config.dbUrl);

  let tables;
  try {
    tables = await introspect(pool);
  } catch (err) {
    await pool.end();
    throw err;
  }

  if (tables.length === 0) {
    await pool.end();
    throw new Error('No tables found in public schema');
  }

  const sortResult = topologicalSort(tables);

  const app = express();
  app.use(cors({
    origin: [
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
      /^https?:\/\/localhost(:\d+)?$/,
    ],
  }));

  const router = createRouter(tables, sortResult.order, config);
  app.use('/mock', router);

  const server = await new Promise<Server>((resolve, reject) => {
    const srv = app.listen(config.port, '127.0.0.1', () => {
      resolve(srv);
    });
    srv.on('error', (err) => {
      reject(err);
    });
  });

  const close = async (): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    await pool.end();
  };

  return { app, server, close };
}
