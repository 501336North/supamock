import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { MockStore } from '../store/mock-store.js';
import type { MockRow } from '../types.js';
import { parseQuery } from './query-parser.js';
import { formatListResponse, formatErrorResponse, applyFilters } from './response-formatter.js';
import { generateRows } from '../generator/data-generator.js';

/** Flatten Express query (string | string[] | ParsedQs) to Record<string, string> */
function flattenQuery(query: Request['query']): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') {
      result[key] = value;
    } else if (Array.isArray(value) && typeof value[0] === 'string') {
      result[key] = value[0];
    }
  }
  return result;
}

/** Extract the table param and verify it exists in the store. Sends error response and returns null on failure. */
function resolveTable(req: Request, res: Response, store: MockStore): string | null {
  const value = req.params['table'];
  const tableName = Array.isArray(value) ? value[0] : value;
  if (!tableName) {
    res.status(400).json(formatErrorResponse('Missing table name', 'PGRST000', null, null));
    return null;
  }

  if (!store.hasTable(tableName)) {
    res.status(404).json(
      formatErrorResponse(
        `Could not find the relation ${tableName} in the schema cache`,
        'PGRST200',
        null,
        null,
      ),
    );
    return null;
  }

  return tableName;
}

export function createRouter(store: MockStore): Router {
  const router = Router();

  // GET /:table — read rows
  router.get('/:table', (req: Request, res: Response, next: NextFunction): void => {
    try {
      const tableName = resolveTable(req, res, store);
      if (!tableName) return;

      const rawQuery = flattenQuery(req.query);
      const { seed: seedParam, ...queryWithoutSeed } = rawQuery;

      const parsedQuery = parseQuery(queryWithoutSeed, req.get('Prefer'));

      // Validate select columns
      const tableInfo = store.getTableInfo(tableName);
      if (tableInfo && parsedQuery.select.columns !== '*') {
        const validColumns = new Set(tableInfo.columns.map((c) => c.name));
        const invalidColumns = parsedQuery.select.columns.filter((c) => !validColumns.has(c));
        if (invalidColumns.length > 0) {
          const availableColumns = tableInfo.columns.map((c) => c.name).join(', ');
          res.status(400).json(
            formatErrorResponse(
              `Column ${invalidColumns.join(', ')} not found`,
              'PGRST102',
              null,
              `Available columns: ${availableColumns}`,
            ),
          );
          return;
        }
      }

      let rows: MockRow[];

      if (seedParam === 'random' && tableInfo) {
        const rowCount = (store.getRows(tableName) ?? []).length;
        rows = generateRows(tableInfo, rowCount);
      } else {
        rows = store.getRows(tableName) ?? [];
      }

      // Only build allData when embeds are present (avoids unnecessary per-request allocation)
      let allData: Record<string, MockRow[]> = {};
      if (parsedQuery.select.embeds.length > 0) {
        allData = Object.fromEntries(
          parsedQuery.select.embeds.map((e) => [e.relation, store.getRows(e.relation) ?? []]),
        );
      }

      const schema = store.getSchema();
      const { body, headers } = formatListResponse(rows, parsedQuery, schema, tableName, allData);

      for (const [key, value] of Object.entries(headers)) {
        res.set(key, value);
      }
      res.set('X-SupaMock', 'true');
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  });

  // POST /:table — create row (does NOT mutate store)
  router.post('/:table', (req: Request, res: Response): void => {
    const tableName = resolveTable(req, res, store);
    if (!tableName) return;

    const prefer = parseQuery({}, req.get('Prefer')).prefer;
    const tableInfo = store.getTableInfo(tableName);
    const requestBody = req.body as Record<string, unknown>;

    // Generate defaults for missing columns
    const row: MockRow = { ...requestBody };

    if (tableInfo) {
      for (const col of tableInfo.columns) {
        if (row[col.name] === undefined && col.defaultValue !== null) {
          if (col.defaultValue === 'gen_random_uuid()') {
            row[col.name] = crypto.randomUUID();
          } else if (col.defaultValue === 'now()') {
            row[col.name] = new Date().toISOString();
          } else if (col.defaultValue.startsWith("nextval(")) {
            row[col.name] = Math.floor(Math.random() * 1000000);
          } else {
            // Strip surrounding quotes from defaults like "'active'"
            const stripped = col.defaultValue.replace(/^'|'$/g, '');
            row[col.name] = stripped;
          }
        }
      }
    }

    res.set('X-SupaMock', 'true');

    if (prefer.return === 'minimal') {
      res.status(201).send('');
      return;
    }

    res.status(201).json([row]);
  });

  // PATCH /:table — update rows (does NOT mutate store)
  router.patch('/:table', (req: Request, res: Response, next: NextFunction): void => {
    try {
      const tableName = resolveTable(req, res, store);
      if (!tableName) return;

      const parsedQuery = parseQuery(flattenQuery(req.query), req.get('Prefer'));
      const matchingRows = applyFilters(store.getRows(tableName) ?? [], parsedQuery.filters);
      const body = req.body as Record<string, unknown>;

      const mergedRows = matchingRows.map((row) => ({ ...row, ...body }));

      res.set('X-SupaMock', 'true');

      if (parsedQuery.prefer.return === 'representation') {
        res.status(200).json(mergedRows);
      } else {
        res.status(200).json([]);
      }
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:table — delete rows (does NOT mutate store)
  router.delete('/:table', (req: Request, res: Response, next: NextFunction): void => {
    try {
      const tableName = resolveTable(req, res, store);
      if (!tableName) return;

      const parsedQuery = parseQuery(flattenQuery(req.query), req.get('Prefer'));
      const matchingRows = applyFilters(store.getRows(tableName) ?? [], parsedQuery.filters);

      res.set('X-SupaMock', 'true');

      if (parsedQuery.prefer.return === 'representation') {
        res.status(200).json(matchingRows);
      } else {
        res.status(200).json([]);
      }
    } catch (err) {
      next(err);
    }
  });

  return router;
}
