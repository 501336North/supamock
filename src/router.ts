import { Router, Request, Response } from 'express';
import { faker as defaultFaker, Faker, en } from '@faker-js/faker';
import { CrossDBRegistryImpl, generateWithDependencies } from './cross-db-registry.js';
import { resolveExpansions } from './expand-resolver.js';
import { formatResponse } from './response-formatter.js';
import type { TableMetadata, ServerConfig, ExpandParams, MockRecord, ColumnMetadata } from './types.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_LIMIT = 1000;
const MAX_INPUT_DISPLAY_LEN = 50;
const RESERVED_ROUTES = new Set(['_status']);

const INTEGER_PK_TYPES = new Set([
  'integer', 'int', 'int4',
  'smallint', 'int2',
  'bigint', 'int8',
  'serial', 'bigserial',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Helpers ────────────────────────────────────────────────────────────────

function sanitizeInput(input: string): string {
  return input.slice(0, MAX_INPUT_DISPLAY_LEN).replace(/[<>"'&]/g, '');
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getPrimaryKeyColumn(table: TableMetadata): ColumnMetadata | undefined {
  return table.columns.find((c) => c.isPrimaryKey);
}

function validateAndParseId(
  idParam: string,
  pkColumn: ColumnMetadata,
): { valid: true; value: unknown } | { valid: false; reason: string } {
  const dataType = pkColumn.dataType.toLowerCase();

  if (INTEGER_PK_TYPES.has(dataType)) {
    const parsed = Number(idParam);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      return {
        valid: false,
        reason: `Invalid ID "${sanitizeInput(idParam)}" for integer primary key. Expected an integer.`,
      };
    }
    return { valid: true, value: parsed };
  }

  if (dataType === 'uuid') {
    if (!UUID_PATTERN.test(idParam)) {
      return {
        valid: false,
        reason: `Invalid ID "${sanitizeInput(idParam)}" for UUID primary key. Expected a valid UUID.`,
      };
    }
    return { valid: true, value: idParam };
  }

  return { valid: true, value: idParam };
}

function parseLimit(
  raw: string | undefined,
  defaultCount: number,
): { value: number } | { error: string } {
  if (raw === undefined || raw === '') {
    return { value: defaultCount };
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return { error: `Invalid limit "${sanitizeInput(raw)}". Must be a positive integer.` };
  }

  if (parsed > MAX_LIMIT) {
    return { error: `Limit ${parsed} exceeds maximum of ${MAX_LIMIT}.` };
  }

  return { value: parsed };
}

function parseOffset(
  raw: string | undefined,
): { value: number } | { error: string } {
  if (raw === undefined || raw === '') {
    return { value: 0 };
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    return { error: `Invalid offset "${sanitizeInput(raw)}". Must be a non-negative integer.` };
  }
  return { value: parsed };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function createRouter(
  tables: TableMetadata[],
  sortOrder: string[],
  config: ServerConfig,
): Router {
  const router = Router();

  const tableMap = new Map<string, TableMetadata>();

  for (const table of tables) {
    tableMap.set(table.name, table);

    if (RESERVED_ROUTES.has(table.name)) {
      console.warn(
        `Table "${table.name}" conflicts with reserved route "/${table.name}". ` +
        `The dynamic data endpoint for this table will not be mounted.`,
      );
    }
  }

  const relationships: Array<{ from: string; to: string; column: string }> = [];
  for (const table of tables) {
    for (const col of table.columns) {
      if (col.foreignKey) {
        relationships.push({
          from: table.name,
          to: col.foreignKey.referencedTable,
          column: col.name,
        });
      }
    }
  }

  // ─── GET /_status ───────────────────────────────────────────────────────────

  router.get('/_status', (_req: Request, res: Response) => {
    res.json({
      tables: tables.map((t) => t.name),
      relationships,
    });
  });

  // ─── GET /:table/:id ───────────────────────────────────────────────────────

  router.get('/:table/:id', (req: Request, res: Response) => {
    const tableName = String(req.params.table);
    const idParam = String(req.params.id);

    const table = tableMap.get(tableName);
    if (!table || RESERVED_ROUTES.has(tableName)) {
      res.status(404).json({ error: 'Table not found.' });
      return;
    }

    const pkColumn = getPrimaryKeyColumn(table);
    if (!pkColumn) {
      res.status(500).json({ error: 'Table has no primary key.' });
      return;
    }

    const idResult = validateAndParseId(idParam, pkColumn);
    if (!idResult.valid) {
      res.status(400).json({ error: idResult.reason });
      return;
    }

    const registry = new CrossDBRegistryImpl();

    const records = generateWithDependencies(
      tableName,
      1,
      tables,
      sortOrder,
      registry,
      defaultFaker,
    );

    if (records.length > 0) {
      records[0][pkColumn.name] = idResult.value;
    }

    const meta = { total: 1, limit: 1, offset: 0 };
    const formatted = formatResponse(records, meta, config.format);

    for (const [key, value] of Object.entries(formatted.headers)) {
      res.setHeader(key, value);
    }

    res.json(formatted.body);
  });

  // ─── GET /:table ────────────────────────────────────────────────────────────

  router.get('/:table', (req: Request, res: Response) => {
    const tableName = String(req.params.table);

    const table = tableMap.get(tableName);
    if (!table || RESERVED_ROUTES.has(tableName)) {
      res.status(404).json({ error: 'Table not found.' });
      return;
    }

    const limitResult = parseLimit(req.query.limit as string | undefined, config.defaultCount);
    if ('error' in limitResult) {
      res.status(400).json({ error: limitResult.error });
      return;
    }
    const limit = limitResult.value;

    const seedParam = req.query.seed as string | undefined;

    const offsetResult = parseOffset(req.query.offset as string | undefined);
    if ('error' in offsetResult) {
      res.status(400).json({ error: offsetResult.error });
      return;
    }
    const offset = offsetResult.value;

    const registry = new CrossDBRegistryImpl();
    let fakerInstance: Faker;

    if (seedParam !== undefined && seedParam !== '') {
      fakerInstance = new Faker({ locale: [en] });
      fakerInstance.seed(hashSeed(seedParam));
    } else {
      fakerInstance = defaultFaker;
    }

    const records = generateWithDependencies(
      tableName,
      limit,
      tables,
      sortOrder,
      registry,
      fakerInstance,
    );

    const expandParams: ExpandParams = {
      expand: req.query.expand as string | undefined,
      select: req.query.select as string | undefined,
    };

    let finalRecords: MockRecord[] = records;

    if (expandParams.expand || expandParams.select) {
      const expandResult = resolveExpansions(
        records,
        expandParams,
        registry,
        table,
        config.format,
      );

      if (expandResult.error) {
        res.status(expandResult.error.status).json({ error: expandResult.error.message });
        return;
      }

      finalRecords = expandResult.records;
    }

    const meta = { total: finalRecords.length, limit, offset };
    const formatted = formatResponse(finalRecords, meta, config.format);

    for (const [key, value] of Object.entries(formatted.headers)) {
      res.setHeader(key, value);
    }

    res.json(formatted.body);
  });

  return router;
}
