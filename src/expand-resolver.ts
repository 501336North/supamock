import type {
  CrossDBRegistry,
  TableMetadata,
  MockRecord,
  ExpandParams,
  ExpandResult,
  ColumnMetadata,
} from './types.js';

// ─── Relation resolution helpers ─────────────────────────────────────────────

function deriveRelationName(column: ColumnMetadata): string {
  const name = column.name;
  if (name.endsWith('_id')) {
    return name.slice(0, -3);
  }
  return name;
}

function buildRelationMap(
  table: TableMetadata,
): Map<string, ColumnMetadata> {
  const relations = new Map<string, ColumnMetadata>();
  for (const col of table.columns) {
    if (col.foreignKey) {
      const relationName = deriveRelationName(col);
      relations.set(relationName, col);
    }
  }
  return relations;
}

// ─── Parsing helpers ─────────────────────────────────────────────────────────

function parseRestExpand(expand: string): string[] {
  return expand
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseSupabaseSelect(select: string): string[] {
  const relations: string[] = [];
  const pattern = /(\w+)\([^)]*\)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(select)) !== null) {
    relations.push(match[1]);
  }

  return relations;
}

// ─── Inline expansion ────────────────────────────────────────────────────────

function inlineRelation(
  records: MockRecord[],
  relationName: string,
  fkColumn: ColumnMetadata,
  registry: CrossDBRegistry,
): MockRecord[] {
  const referencedTable = fkColumn.foreignKey!.referencedTable;
  const referencedColumn = fkColumn.foreignKey!.referencedColumn;
  const parentRecords = registry.get(referencedTable);

  const parentIndex = new Map<unknown, MockRecord>();
  for (const parent of parentRecords) {
    parentIndex.set(parent[referencedColumn], parent);
  }

  return records.map((record) => {
    const fkValue = record[fkColumn.name];
    const parentRecord = parentIndex.get(fkValue);

    return {
      ...record,
      [relationName]: parentRecord ?? null,
    };
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function resolveExpansions(
  records: MockRecord[],
  params: ExpandParams,
  registry: CrossDBRegistry,
  tableMetadata: TableMetadata,
  format: 'rest' | 'supabase',
): ExpandResult {
  if (format === 'supabase' && params.expand) {
    return {
      records,
      error: {
        status: 400,
        message:
          'The "expand" parameter is not supported in Supabase mode. Use "select" with relation syntax instead (e.g., select=*,user(*)).',
      },
    };
  }

  if (format === 'rest' && params.select) {
    return {
      records,
      error: {
        status: 400,
        message:
          'The "select" parameter is not supported in REST mode. Use "expand" instead (e.g., expand=user,product).',
      },
    };
  }

  if (!params.expand && !params.select) {
    return { records };
  }

  let requestedRelations: string[];

  if (format === 'rest' && params.expand) {
    requestedRelations = parseRestExpand(params.expand);
  } else if (format === 'supabase' && params.select) {
    requestedRelations = parseSupabaseSelect(params.select);
  } else {
    return { records };
  }

  if (requestedRelations.length === 0) {
    return { records };
  }

  const relationMap = buildRelationMap(tableMetadata);
  const validNames = Array.from(relationMap.keys());

  for (const name of requestedRelations) {
    if (!relationMap.has(name)) {
      return {
        records,
        error: {
          status: 400,
          message: `Invalid relation "${name}". Valid relations: ${validNames.join(', ')}`,
        },
      };
    }
  }

  let result = records;

  for (const name of requestedRelations) {
    const fkColumn = relationMap.get(name)!;
    result = inlineRelation(result, name, fkColumn, registry);
  }

  return { records: result };
}
