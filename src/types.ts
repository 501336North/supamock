import type { Faker } from '@faker-js/faker';

export interface ForeignKey {
  referencedTable: string;
  referencedColumn: string;
}

export interface ColumnMetadata {
  name: string;
  dataType: string;
  isNullable: boolean;
  isUnique: boolean;
  isPrimaryKey: boolean;
  foreignKey: ForeignKey | null;
  checkConstraint: string[] | null;  // parsed enum values from CHECK IN
  enumValues: string[] | null;        // from CREATE TYPE ... AS ENUM
  comment: string | null;             // Postgres column comment (e.g., 'faker:internet.email')
  columnDefault: string | null;
}

export interface TableMetadata {
  name: string;
  columns: ColumnMetadata[];
}

export interface ServerConfig {
  dbUrl: string;
  port: number;
  defaultCount: number;
  format: 'rest' | 'supabase';
}

export type MockRecord = Record<string, unknown>;

export interface CrossDBRegistry {
  store(tableName: string, records: MockRecord[]): void;
  get(tableName: string): MockRecord[];
  pickForeignKey(tableName: string, columnName: string, fakerInstance?: Faker): unknown;
}

export interface SortResult {
  order: string[];
  brokenEdges: BrokenEdge[];
}

export interface BrokenEdge {
  fromTable: string;
  toTable: string;
  column: string;
}

export interface FormattedResponse {
  body: unknown;
  headers: Record<string, string>;
}

export interface ResponseMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface ExpandParams {
  expand?: string;       // REST mode: comma-separated
  select?: string;       // Supabase mode: select syntax
}

export interface ExpandResult {
  records: MockRecord[];
  error?: { status: number; message: string };
}
