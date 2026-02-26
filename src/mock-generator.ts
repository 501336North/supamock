import { faker as defaultFaker, Faker } from '@faker-js/faker';
import { mapColumn } from './faker-mapper.js';
import type { TableMetadata, ColumnMetadata, MockRecord } from './types.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const NULLABLE_THRESHOLD = 0.2;
const UNIQUE_MAX_RETRIES = 100;

const INTEGER_TYPES = new Set([
  'integer', 'int', 'int4',
  'smallint', 'int2',
  'bigint', 'int8',
  'serial', 'bigserial',
]);

// ─── Type detection helpers ──────────────────────────────────────────────────

function isIntegerType(dataType: string): boolean {
  return INTEGER_TYPES.has(dataType.toLowerCase());
}

function isUuidType(dataType: string): boolean {
  return dataType.toLowerCase() === 'uuid';
}

// ─── PK value generation ─────────────────────────────────────────────────────

function generatePrimaryKey(
  column: ColumnMetadata,
  index: number,
  fakerInstance: Faker,
): unknown {
  if (isIntegerType(column.dataType)) {
    return index + 1;
  }
  if (isUuidType(column.dataType)) {
    return fakerInstance.string.uuid();
  }
  return mapColumn(column, fakerInstance)();
}

// ─── Nullable logic ──────────────────────────────────────────────────────────

function shouldBeNull(fakerInstance: Faker): boolean {
  return fakerInstance.number.float({ min: 0, max: 1 }) < NULLABLE_THRESHOLD;
}

// ─── Unique value generation with retry ──────────────────────────────────────

function generateUniqueValue(
  generator: () => unknown,
  seen: Set<unknown>,
  columnName: string,
): unknown {
  for (let attempt = 0; attempt < UNIQUE_MAX_RETRIES; attempt++) {
    const value = generator();
    if (!seen.has(value)) {
      seen.add(value);
      return value;
    }
  }
  throw new Error(
    `Failed to generate unique value for column "${columnName}" after ${UNIQUE_MAX_RETRIES} attempts`,
  );
}

// ─── Per-column value resolution ─────────────────────────────────────────────

interface GenerationContext {
  generators: Map<string, () => unknown>;
  uniqueSets: Map<string, Set<unknown>>;
  faker: Faker;
}

function resolveColumnValue(
  column: ColumnMetadata,
  recordIndex: number,
  ctx: GenerationContext,
): unknown {
  if (column.isPrimaryKey) {
    return generatePrimaryKey(column, recordIndex, ctx.faker);
  }

  if (column.isNullable && !column.isUnique && shouldBeNull(ctx.faker)) {
    return null;
  }

  const generator = ctx.generators.get(column.name)!;

  if (column.isUnique) {
    const seen = ctx.uniqueSets.get(column.name)!;
    return generateUniqueValue(generator, seen, column.name);
  }

  return generator();
}

// ─── Context preparation ─────────────────────────────────────────────────────

function buildContext(table: TableMetadata, faker: Faker): GenerationContext {
  const generators = new Map<string, () => unknown>();
  const uniqueSets = new Map<string, Set<unknown>>();

  for (const column of table.columns) {
    if (column.isPrimaryKey) continue;

    generators.set(column.name, mapColumn(column, faker));

    if (column.isUnique) {
      uniqueSets.set(column.name, new Set());
    }
  }

  return { generators, uniqueSets, faker };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function generateRecords(
  table: TableMetadata,
  count: number,
  fakerInstance?: Faker,
): MockRecord[] {
  const faker = fakerInstance ?? defaultFaker;
  const ctx = buildContext(table, faker);
  const records: MockRecord[] = [];

  for (let i = 0; i < count; i++) {
    const record: MockRecord = {};
    for (const column of table.columns) {
      record[column.name] = resolveColumnValue(column, i, ctx);
    }
    records.push(record);
  }

  return records;
}
