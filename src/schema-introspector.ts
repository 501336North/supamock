import pg from 'pg';
import type { TableMetadata, ColumnMetadata, ForeignKey } from './types.js';

// ------------------------------------------------------------------ //
//  Pool factory                                                       //
// ------------------------------------------------------------------ //

export function createReadOnlyPool(dbUrl: string): pg.Pool {
  const pool = new pg.Pool({ connectionString: dbUrl });

  pool.on('connect', (client: pg.PoolClient) => {
    client.query('SET default_transaction_read_only = true').catch((err) => {
      client.release(true);
      throw new Error(`Failed to set read-only mode: ${err instanceof Error ? err.message : String(err)}`);
    });
  });

  return pool;
}

// ------------------------------------------------------------------ //
//  Row types for the introspection queries                            //
// ------------------------------------------------------------------ //

interface TableRow {
  table_name: string;
}

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string; // 'YES' | 'NO'
  column_default: string | null;
}

interface ConstraintRow {
  table_name: string;
  column_name: string;
  constraint_type: string; // 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE'
  referenced_table: string | null;
  referenced_column: string | null;
}

interface CheckConstraintRow {
  table_name: string;
  column_name: string;
  constraint_def: string;
}

interface CommentRow {
  table_name: string;
  column_name: string;
  description: string;
}

// ------------------------------------------------------------------ //
//  SQL queries                                                        //
// ------------------------------------------------------------------ //

const TABLES_SQL = `
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
  ORDER BY table_name;
`;

const COLUMNS_SQL = `
  SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position;
`;

const CONSTRAINTS_SQL = `
  SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_type,
    ccu.table_name  AS referenced_table,
    ccu.column_name AS referenced_column
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema   = kcu.table_schema
  LEFT JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
   AND tc.table_schema   = ccu.table_schema
   AND tc.constraint_type = 'FOREIGN KEY'
  WHERE tc.table_schema = 'public'
    AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE');
`;

const CHECK_CONSTRAINTS_SQL = `
  SELECT
    cls.relname            AS table_name,
    att.attname            AS column_name,
    pg_get_constraintdef(con.oid) AS constraint_def
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class     cls ON con.conrelid = cls.oid
  JOIN pg_catalog.pg_namespace nsp ON nsp.oid = cls.relnamespace
  JOIN pg_catalog.pg_attribute att
    ON att.attrelid = con.conrelid
   AND att.attnum = ANY(con.conkey)
  WHERE nsp.nspname = 'public'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%ANY%';
`;

const COMMENTS_SQL = `
  SELECT
    c.relname  AS table_name,
    a.attname  AS column_name,
    d.description
  FROM pg_catalog.pg_description d
  JOIN pg_catalog.pg_class     c ON d.objoid  = c.oid
  JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND a.attnum > 0
    AND NOT a.attisdropped;
`;

// ------------------------------------------------------------------ //
//  CHECK-constraint parser                                            //
// ------------------------------------------------------------------ //

function parseCheckValues(clause: string): string[] | null {
  const matches = clause.match(/'([^']+)'/g);
  if (!matches || matches.length === 0) return null;
  return matches.map((m) => m.replace(/'/g, ''));
}

// ------------------------------------------------------------------ //
//  Main introspect function                                           //
// ------------------------------------------------------------------ //

export async function introspect(pool: pg.Pool): Promise<TableMetadata[]> {
  const [tablesRes, columnsRes, constraintsRes, checkRes, commentsRes] = await Promise.all([
    pool.query<TableRow>(TABLES_SQL),
    pool.query<ColumnRow>(COLUMNS_SQL),
    pool.query<ConstraintRow>(CONSTRAINTS_SQL),
    pool.query<CheckConstraintRow>(CHECK_CONSTRAINTS_SQL),
    pool.query<CommentRow>(COMMENTS_SQL),
  ]);

  type ConstraintInfo = {
    isPrimaryKey: boolean;
    isUnique: boolean;
    foreignKey: ForeignKey | null;
    checkConstraint: string[] | null;
  };

  const constraintMap = new Map<string, ConstraintInfo>();

  function getKey(table: string, column: string): string {
    return `${table}::${column}`;
  }

  function ensureConstraint(table: string, column: string): ConstraintInfo {
    const key = getKey(table, column);
    let info = constraintMap.get(key);
    if (!info) {
      info = { isPrimaryKey: false, isUnique: false, foreignKey: null, checkConstraint: null };
      constraintMap.set(key, info);
    }
    return info;
  }

  for (const row of constraintsRes.rows) {
    if (!row.column_name) continue;

    const info = ensureConstraint(row.table_name, row.column_name);

    switch (row.constraint_type) {
      case 'PRIMARY KEY':
        info.isPrimaryKey = true;
        break;
      case 'UNIQUE':
        info.isUnique = true;
        break;
      case 'FOREIGN KEY':
        if (row.referenced_table && row.referenced_column) {
          info.foreignKey = {
            referencedTable: row.referenced_table,
            referencedColumn: row.referenced_column,
          };
        }
        break;
    }
  }

  for (const row of checkRes.rows) {
    if (!row.column_name || !row.constraint_def) continue;
    const values = parseCheckValues(row.constraint_def);
    if (values && values.length > 0) {
      const info = ensureConstraint(row.table_name, row.column_name);
      info.checkConstraint = values;
    }
  }

  const commentMap = new Map<string, string>();
  for (const row of commentsRes.rows) {
    commentMap.set(getKey(row.table_name, row.column_name), row.description);
  }

  const columnsByTable = new Map<string, ColumnRow[]>();
  for (const row of columnsRes.rows) {
    let arr = columnsByTable.get(row.table_name);
    if (!arr) {
      arr = [];
      columnsByTable.set(row.table_name, arr);
    }
    arr.push(row);
  }

  const tables: TableMetadata[] = tablesRes.rows.map((tableRow) => {
    const tableName = tableRow.table_name;
    const colRows = columnsByTable.get(tableName) ?? [];

    const columns: ColumnMetadata[] = colRows.map((cr) => {
      const key = getKey(tableName, cr.column_name);
      const ci = constraintMap.get(key);
      const comment = commentMap.get(key) ?? null;

      return {
        name: cr.column_name,
        dataType: cr.data_type,
        isNullable: cr.is_nullable === 'YES',
        isUnique: ci?.isUnique ?? false,
        isPrimaryKey: ci?.isPrimaryKey ?? false,
        foreignKey: ci?.foreignKey ?? null,
        checkConstraint: ci?.checkConstraint ?? null,
        enumValues: null,
        comment,
        columnDefault: cr.column_default,
      };
    });

    return { name: tableName, columns };
  });

  return tables;
}
