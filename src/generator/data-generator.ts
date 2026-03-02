import { faker } from '@faker-js/faker';
import type { TableInfo, MockRow, ForeignKey, ColumnInfo } from '../types.js';
import { mapColumn } from './column-mapper.js';

/** Probability that a nullable column receives null */
const NULL_PROBABILITY = 0.2;

/** Maximum retries when generating unique values */
const MAX_UNIQUE_RETRIES = 100;

/** Fixed reference date used for deterministic timestamp generation when seeded */
const FIXED_REF_DATE = new Date('2025-01-01T00:00:00.000Z');

/** Timestamp types that need a fixed reference date for determinism */
const TIMESTAMP_TYPES = new Set([
  'timestamptz',
  'timestamp',
  'timestamp without time zone',
  'timestamp with time zone',
  'date',
]);

/**
 * Generates mock rows for a given table definition.
 *
 * Uses mapColumn to get generators for each column, respects nullability,
 * foreign key references, unique constraints, and seeded determinism.
 */
export function generateRows(
  table: TableInfo,
  count: number,
  seed?: number,
  parentData?: Record<string, MockRow[]>,
): MockRow[] {
  if (seed !== undefined) {
    faker.seed(seed);
  }

  // Build a lookup of FK column name -> ForeignKey for quick access
  const fkByColumn = new Map<string, ForeignKey>();
  for (const fk of table.foreignKeys) {
    fkByColumn.set(fk.column, fk);
  }

  // Build generators once per column.
  // When seeded, override timestamp generators to use a fixed reference date
  // so that output is fully deterministic (faker.date.recent() uses Date.now()
  // by default, which breaks reproducibility).
  const generators = new Map<string, (() => unknown) | null>();
  for (const column of table.columns) {
    if (seed !== undefined && TIMESTAMP_TYPES.has(column.type.toLowerCase())) {
      const lowerType = column.type.toLowerCase();
      if (lowerType === 'date') {
        generators.set(column.name, () =>
          faker.date.recent({ refDate: FIXED_REF_DATE }).toISOString().split('T')[0],
        );
      } else {
        generators.set(column.name, () =>
          faker.date.recent({ refDate: FIXED_REF_DATE }).toISOString(),
        );
      }
    } else {
      generators.set(column.name, mapColumn(column));
    }
  }

  // Track unique values per column that has isUnique
  const uniqueSets = new Map<string, Set<unknown>>();
  for (const column of table.columns) {
    if (column.isUnique) {
      uniqueSets.set(column.name, new Set<unknown>());
    }
  }

  const rows: MockRow[] = [];

  for (let i = 0; i < count; i++) {
    const row: MockRow = {};

    for (const column of table.columns) {
      row[column.name] = generateColumnValue(
        column,
        fkByColumn.get(column.name),
        generators.get(column.name) ?? null,
        uniqueSets.get(column.name),
        parentData,
        i,
      );
    }

    rows.push(row);
  }

  return rows;
}

function generateColumnValue(
  column: ColumnInfo,
  fk: ForeignKey | undefined,
  generator: (() => unknown) | null,
  uniqueSet: Set<unknown> | undefined,
  parentData: Record<string, MockRow[]> | undefined,
  rowIndex: number,
): unknown {
  // 1. Handle FK columns
  if (fk) {
    const parentRows = parentData?.[fk.referencedTable];

    if (parentRows && parentRows.length > 0) {
      const parentRow = faker.helpers.arrayElement(parentRows);
      return parentRow[fk.referencedColumn] ?? null;
    }

    // Parent data unavailable (circular dep) -- use null for nullable
    if (column.nullable) {
      return null;
    }

    // Non-nullable FK with no parent data -- fall through to normal generation
  }

  // 2. Nullable columns have ~20% chance of null
  if (column.nullable && faker.number.float({ min: 0, max: 1 }) < NULL_PROBABILITY) {
    return null;
  }

  // 3. No generator available
  if (!generator) {
    return null;
  }

  // 4. Unique constraint handling
  if (uniqueSet) {
    return generateUniqueValue(generator, uniqueSet, column, rowIndex);
  }

  // 5. Normal generation
  return generator();
}

function generateUniqueValue(
  generator: () => unknown,
  seen: Set<unknown>,
  column: ColumnInfo,
  rowIndex: number,
): unknown {
  for (let attempt = 0; attempt < MAX_UNIQUE_RETRIES; attempt++) {
    const value = generator();
    if (!seen.has(value)) {
      seen.add(value);
      return value;
    }
  }

  // Retries exhausted -- append counter suffix for string types
  const baseValue = generator();
  const lowerType = column.type.toLowerCase();

  if (
    lowerType === 'text' ||
    lowerType === 'varchar' ||
    lowerType === 'character varying'
  ) {
    const suffixed = `${String(baseValue)}_${rowIndex}`;
    seen.add(suffixed);
    return suffixed;
  }

  // For non-string types, just return the value (best effort)
  seen.add(baseValue);
  return baseValue;
}
