/** Information about a single column in a table */
export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isEnum: boolean;
  enumValues: string[];
  isUnique: boolean;
}

/** A foreign key relationship */
export interface ForeignKey {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

/** Information about a database table */
export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  primaryKey: string[];
  foreignKeys: ForeignKey[];
}

/** The complete schema definition from introspection */
export interface SchemaDefinition {
  tables: TableInfo[];
}

/** PostgREST filter operators */
export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'in'
  | 'is';

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/** Embedded relation in select */
export interface EmbedClause {
  relation: string;
  columns: string[] | '*';
}

/** Column selection, possibly with embedded relations */
export interface SelectClause {
  columns: string[] | '*';
  embeds: EmbedClause[];
}

/** A single filter condition */
export interface Filter {
  column: string;
  operator: FilterOperator;
  value: string | string[] | null;
}

/** Order by clause */
export interface OrderClause {
  column: string;
  direction: SortDirection;
}

/** Parsed Prefer header */
export interface PreferHeader {
  count?: 'exact';
  return?: 'representation' | 'minimal';
}

/** Parsed query from PostgREST URL */
export interface PostgRESTQuery {
  select: SelectClause;
  filters: Filter[];
  order: OrderClause[];
  limit: number;
  offset: number;
  prefer: PreferHeader;
}

/** PostgREST error response */
export interface PostgRESTError {
  message: string;
  code: string;
  details: string | null;
  hint: string | null;
}

/** Row of mock data (dynamic based on schema) */
export type MockRow = Record<string, unknown>;
