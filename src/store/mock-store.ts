import type { SchemaDefinition, TableInfo, MockRow } from '../types.js';
import { generateRows } from '../generator/data-generator.js';
import { buildDependencyGraph, topologicalSort } from '../schema/dependency-graph.js';

export class MockStore {
  private data: Map<string, MockRow[]>;
  private schema: SchemaDefinition;
  private tableIndex: Map<string, TableInfo>;

  constructor(schema: SchemaDefinition) {
    this.data = new Map();
    this.schema = schema;
    this.tableIndex = new Map(schema.tables.map((t) => [t.name, t]));
  }

  /** Seed all tables with generated data in dependency order */
  seed(rowsPerTable: number, globalSeed?: number): void {
    const graph = buildDependencyGraph(this.schema);
    const { sorted } = topologicalSort(graph);

    const parentData: Record<string, MockRow[]> = {};

    for (const tableName of sorted) {
      const tableInfo = this.tableIndex.get(tableName);
      if (!tableInfo) {
        continue;
      }

      const rows = generateRows(tableInfo, rowsPerTable, globalSeed, parentData);
      this.data.set(tableName, rows);
      parentData[tableName] = rows;
    }
  }

  /** Seed with pre-built row data (for testing) */
  seedFromData(data: Record<string, MockRow[]>): void {
    for (const [tableName, rows] of Object.entries(data)) {
      this.data.set(tableName, rows);
    }
  }

  /** Get all rows for a table */
  getRows(tableName: string): MockRow[] | undefined {
    return this.data.get(tableName);
  }

  /** Get all table names */
  getTableNames(): string[] {
    return [...this.data.keys()];
  }

  /** Check if a table exists */
  hasTable(tableName: string): boolean {
    return this.data.has(tableName);
  }

  /** Find a row by primary key value(s) */
  findByPK(tableName: string, pk: Record<string, unknown>): MockRow | undefined {
    const rows = this.data.get(tableName);
    if (!rows) {
      return undefined;
    }

    const pkEntries = Object.entries(pk);
    return rows.find((row) =>
      pkEntries.every(([key, value]) => row[key] === value),
    );
  }

  /** Get the schema */
  getSchema(): SchemaDefinition {
    return this.schema;
  }

  /** Get table info for a specific table */
  getTableInfo(tableName: string): TableInfo | undefined {
    return this.tableIndex.get(tableName);
  }
}
