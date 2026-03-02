import type { Client, QueryResult } from 'pg';
import type {
  SchemaDefinition,
  TableInfo,
  ColumnInfo,
  ForeignKey,
} from '../types.js';

// ---- Row shapes returned by information_schema / pg_catalog queries --------

interface TableRow {
  table_name: string;
}

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface ForeignKeyRow {
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
}

interface PrimaryKeyRow {
  table_name: string;
  column_name: string;
}

interface UniqueConstraintRow {
  table_name: string;
  column_name: string;
}

interface EnumRow {
  typname: string;
  enumlabel: string;
}

interface EnumColumnRow {
  table_name: string;
  column_name: string;
  udt_name: string;
}

// ---- SQL queries -----------------------------------------------------------

const TABLES_SQL = `
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = $1
    AND table_type = 'BASE TABLE'
  ORDER BY table_name
`;

const COLUMNS_SQL = `
  SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = $1
  ORDER BY table_name, ordinal_position
`;

const FOREIGN_KEYS_SQL = `
  SELECT
    kcu.table_name AS source_table,
    kcu.column_name AS source_column,
    ccu.table_name AS target_table,
    ccu.column_name AS target_column
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = $1
`;

const PRIMARY_KEYS_SQL = `
  SELECT
    kcu.table_name,
    kcu.column_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = $1
  ORDER BY kcu.table_name, kcu.ordinal_position
`;

const UNIQUE_CONSTRAINTS_SQL = `
  SELECT
    kcu.table_name,
    kcu.column_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'UNIQUE'
    AND tc.table_schema = $1
`;

const ENUMS_SQL = `
  SELECT
    t.typname,
    e.enumlabel
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  JOIN pg_namespace n ON t.typnamespace = n.oid
  WHERE n.nspname = $1
  ORDER BY t.typname, e.enumsortorder
`;

const ENUM_COLUMNS_SQL = `
  SELECT
    c.table_name,
    c.column_name,
    c.udt_name
  FROM information_schema.columns c
  WHERE c.table_schema = $1
    AND c.data_type = 'USER-DEFINED'
`;

// ---- Implementation --------------------------------------------------------

export async function introspectSchema(
  client: Client,
  schemaName?: string,
): Promise<SchemaDefinition> {
  const schema = schemaName ?? 'public';

  // 1. Discover tables
  const tablesResult: QueryResult<TableRow> = await client.query(TABLES_SQL, [schema]);
  const tableNames = tablesResult.rows.map((r) => r.table_name);

  // 2. Discover columns (single bulk query instead of per-table)
  const colResult: QueryResult<ColumnRow> = await client.query(COLUMNS_SQL, [schema]);
  const columnsMap = new Map<string, ColumnInfo[]>();
  for (const r of colResult.rows) {
    const col: ColumnInfo = {
      name: r.column_name,
      type: r.data_type,
      nullable: r.is_nullable === 'YES',
      defaultValue: r.column_default,
      isEnum: false,
      enumValues: [] as string[],
      isUnique: false,
    };
    const existing = columnsMap.get(r.table_name) ?? [];
    existing.push(col);
    columnsMap.set(r.table_name, existing);
  }

  // 3. Foreign keys
  const fkResult: QueryResult<ForeignKeyRow> = await client.query(FOREIGN_KEYS_SQL, [schema]);
  const foreignKeysMap = new Map<string, ForeignKey[]>();
  for (const row of fkResult.rows) {
    const existing = foreignKeysMap.get(row.source_table) ?? [];
    existing.push({
      column: row.source_column,
      referencedTable: row.target_table,
      referencedColumn: row.target_column,
    });
    foreignKeysMap.set(row.source_table, existing);
  }

  // 4. Primary keys
  const pkResult: QueryResult<PrimaryKeyRow> = await client.query(PRIMARY_KEYS_SQL, [schema]);
  const primaryKeysMap = new Map<string, string[]>();
  for (const row of pkResult.rows) {
    const existing = primaryKeysMap.get(row.table_name) ?? [];
    existing.push(row.column_name);
    primaryKeysMap.set(row.table_name, existing);
  }

  // 5. Unique constraints
  const uniqueResult: QueryResult<UniqueConstraintRow> = await client.query(
    UNIQUE_CONSTRAINTS_SQL,
    [schema],
  );
  const uniqueColumnsSet = new Set<string>();
  for (const row of uniqueResult.rows) {
    uniqueColumnsSet.add(`${row.table_name}.${row.column_name}`);
  }

  // 6. Enums
  const enumResult: QueryResult<EnumRow> = await client.query(ENUMS_SQL, [schema]);
  const enumValuesMap = new Map<string, string[]>();
  for (const row of enumResult.rows) {
    const existing = enumValuesMap.get(row.typname) ?? [];
    existing.push(row.enumlabel);
    enumValuesMap.set(row.typname, existing);
  }

  // 7. Enum column mapping (only if enums exist)
  const enumColumnMap = new Map<string, string>();
  if (enumValuesMap.size > 0) {
    const enumColResult: QueryResult<EnumColumnRow> = await client.query(
      ENUM_COLUMNS_SQL,
      [schema],
    );
    for (const row of enumColResult.rows) {
      enumColumnMap.set(`${row.table_name}.${row.column_name}`, row.udt_name);
    }
  }

  // 8. Assemble tables
  const tables: TableInfo[] = tableNames.map((tableName) => {
    const columns = columnsMap.get(tableName) ?? [];

    // Apply unique constraint flag
    for (const col of columns) {
      if (uniqueColumnsSet.has(`${tableName}.${col.name}`)) {
        col.isUnique = true;
      }
    }

    // Apply enum info
    for (const col of columns) {
      const enumTypeName = enumColumnMap.get(`${tableName}.${col.name}`);
      if (enumTypeName) {
        col.isEnum = true;
        col.enumValues = enumValuesMap.get(enumTypeName) ?? [];
      }
    }

    return {
      name: tableName,
      columns,
      primaryKey: primaryKeysMap.get(tableName) ?? [],
      foreignKeys: foreignKeysMap.get(tableName) ?? [],
    };
  });

  return { tables };
}
