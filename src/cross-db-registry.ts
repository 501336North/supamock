import { faker as defaultFaker, Faker } from '@faker-js/faker';
import { generateRecords } from './mock-generator.js';
import type { CrossDBRegistry, TableMetadata, MockRecord } from './types.js';

// ─── CrossDBRegistryImpl ─────────────────────────────────────────────────────

export class CrossDBRegistryImpl implements CrossDBRegistry {
  private data: Map<string, MockRecord[]> = new Map();

  store(tableName: string, records: MockRecord[]): void {
    this.data.set(tableName, records);
  }

  get(tableName: string): MockRecord[] {
    return this.data.get(tableName) ?? [];
  }

  pickForeignKey(tableName: string, columnName: string, fakerInstance?: Faker): unknown {
    const records = this.get(tableName);
    if (records.length === 0) {
      return undefined;
    }
    const f = fakerInstance ?? defaultFaker;
    const randomIndex = f.number.int({ min: 0, max: records.length - 1 });
    return records[randomIndex][columnName];
  }
}

// ─── Dependency resolution ───────────────────────────────────────────────────

function collectDependencies(
  targetTable: string,
  tables: TableMetadata[],
): Set<string> {
  const tableMap = new Map<string, TableMetadata>();
  for (const t of tables) {
    tableMap.set(t.name, t);
  }

  const dependencies = new Set<string>();
  const queue: string[] = [targetTable];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const table = tableMap.get(current);
    if (!table) continue;

    for (const col of table.columns) {
      if (
        col.foreignKey &&
        col.foreignKey.referencedTable !== current &&
        !dependencies.has(col.foreignKey.referencedTable)
      ) {
        dependencies.add(col.foreignKey.referencedTable);
        queue.push(col.foreignKey.referencedTable);
      }
    }
  }

  return dependencies;
}

function overrideForeignKeys(
  records: MockRecord[],
  table: TableMetadata,
  registry: CrossDBRegistryImpl,
  fakerInstance?: Faker,
): void {
  for (const record of records) {
    for (const col of table.columns) {
      if (col.foreignKey) {
        const fkValue = registry.pickForeignKey(
          col.foreignKey.referencedTable,
          col.foreignKey.referencedColumn,
          fakerInstance,
        );
        if (fkValue !== undefined) {
          record[col.name] = fkValue;
        }
      }
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function generateWithDependencies(
  targetTable: string,
  limit: number,
  tables: TableMetadata[],
  sortOrder: string[],
  registry: CrossDBRegistryImpl,
  fakerInstance?: Faker,
): MockRecord[] {
  const faker = fakerInstance ?? defaultFaker;

  const tableMap = new Map<string, TableMetadata>();
  for (const t of tables) {
    tableMap.set(t.name, t);
  }

  const dependencies = collectDependencies(targetTable, tables);

  const tablesToGenerate = sortOrder.filter(
    (name) => name === targetTable || dependencies.has(name),
  );

  for (const tableName of tablesToGenerate) {
    const table = tableMap.get(tableName);
    if (!table) continue;

    if (registry.get(tableName).length > 0) continue;

    const count =
      tableName === targetTable
        ? limit
        : Math.max(1, Math.ceil(limit / 3));

    const records = generateRecords(table, count, faker);

    overrideForeignKeys(records, table, registry, faker);

    registry.store(tableName, records);
  }

  return registry.get(targetTable);
}
