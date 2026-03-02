import type {
  MockRow,
  PostgRESTQuery,
  PostgRESTError,
  SchemaDefinition,
  SelectClause,
  Filter,
  OrderClause,
  EmbedClause,
} from '../types.js';

export function applyFilters(rows: MockRow[], filters: Filter[]): MockRow[] {
  let result = rows;

  for (const filter of filters) {
    result = result.filter((row) => {
      const cellValue = row[filter.column];

      switch (filter.operator) {
        case 'eq':
          return cellValue === filter.value || String(cellValue) === filter.value;

        case 'neq':
          return cellValue !== filter.value && String(cellValue) !== filter.value;

        case 'gt':
          return Number(cellValue) > Number(filter.value);

        case 'gte':
          return Number(cellValue) >= Number(filter.value);

        case 'lt':
          return Number(cellValue) < Number(filter.value);

        case 'lte':
          return Number(cellValue) <= Number(filter.value);

        case 'like': {
          const pattern = wildcardToRegex(String(filter.value), false);
          return pattern.test(String(cellValue));
        }

        case 'ilike': {
          const pattern = wildcardToRegex(String(filter.value), true);
          return pattern.test(String(cellValue));
        }

        case 'in': {
          const values = filter.value as string[];
          return values.some(
            (v) => cellValue === v || String(cellValue) === v,
          );
        }

        case 'is':
          // filter.value is null for `is.null`
          if (filter.value === null) {
            return cellValue === null || cellValue === undefined;
          }
          return false;
      }
    });
  }

  return result;
}

function wildcardToRegex(pattern: string, caseInsensitive: boolean): RegExp {
  // Escape regex special chars, then replace PostgREST wildcard `*` with `.*`
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regexStr = '^' + escaped.replace(/\*/g, '.*') + '$';
  return new RegExp(regexStr, caseInsensitive ? 'i' : '');
}

export function applySelect(rows: MockRow[], select: SelectClause): MockRow[] {
  if (select.columns === '*') {
    return rows;
  }

  const columns = select.columns;
  return rows.map((row) => {
    const projected: MockRow = {};
    for (const col of columns) {
      projected[col] = row[col];
    }
    return projected;
  });
}

export function applyOrder(rows: MockRow[], order: OrderClause[]): MockRow[] {
  if (order.length === 0) {
    return rows;
  }

  return [...rows].sort((a, b) => {
    for (const clause of order) {
      const aVal = a[clause.column];
      const bVal = b[clause.column];

      let cmp: number;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }

      if (cmp !== 0) {
        return clause.direction === 'desc' ? -cmp : cmp;
      }
    }
    return 0;
  });
}

export function applyPagination(
  rows: MockRow[],
  limit: number,
  offset: number,
): MockRow[] {
  if (limit === 0) {
    return rows.slice(offset);
  }
  return rows.slice(offset, offset + limit);
}

export function embedRelations(
  rows: MockRow[],
  embeds: EmbedClause[],
  tableName: string,
  schema: SchemaDefinition,
  allData: Record<string, MockRow[]>,
): MockRow[] {
  if (embeds.length === 0) {
    return rows;
  }

  const tableInfo = schema.tables.find((t) => t.name === tableName);
  if (!tableInfo) {
    return rows;
  }

  // Pre-index: build a Map per embed for O(1) lookup instead of O(N) scan
  const embedIndexes = new Map<string, { fkColumn: string; index: Map<unknown, MockRow> }>();
  for (const embed of embeds) {
    const fk = tableInfo.foreignKeys.find((f) => f.referencedTable === embed.relation);
    if (!fk) continue;
    const relatedRows = allData[embed.relation];
    if (!relatedRows) continue;

    const index = new Map<unknown, MockRow>();
    for (const r of relatedRows) {
      index.set(r[fk.referencedColumn], r);
    }
    embedIndexes.set(embed.relation, { fkColumn: fk.column, index });
  }

  return rows.map((row) => {
    const newRow: MockRow = { ...row };

    for (const embed of embeds) {
      const entry = embedIndexes.get(embed.relation);
      if (!entry) {
        continue;
      }

      const fkValue = row[entry.fkColumn];
      const matchedRow = entry.index.get(fkValue);

      if (matchedRow) {
        if (embed.columns === '*') {
          newRow[embed.relation] = { ...matchedRow };
        } else {
          const projected: MockRow = {};
          for (const col of embed.columns) {
            projected[col] = matchedRow[col];
          }
          newRow[embed.relation] = projected;
        }
      } else {
        newRow[embed.relation] = null;
      }
    }

    return newRow;
  });
}

export function formatListResponse(
  rows: MockRow[],
  query: PostgRESTQuery,
  schema: SchemaDefinition,
  tableName: string,
  allData: Record<string, MockRow[]>,
): { body: MockRow[]; headers: Record<string, string> } {
  // 1. Apply filters
  let result = applyFilters(rows, query.filters);

  // 2. Store totalCount for Content-Range
  const totalCount = result.length;

  // 3. Apply ordering
  result = applyOrder(result, query.order);

  // 4. Apply pagination
  result = applyPagination(result, query.limit, query.offset);

  // 5. Apply embeds
  result = embedRelations(result, query.select.embeds, tableName, schema, allData);

  // 6. Apply select (column projection)
  result = applySelect(result, query.select);

  // 7. Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // 8. Content-Range if prefer.count === 'exact'
  if (query.prefer.count === 'exact') {
    const rangeStart = query.offset;
    const rangeEnd = query.offset + result.length - 1;
    headers['Content-Range'] = `${rangeStart}-${rangeEnd}/${totalCount}`;
  }

  return { body: result, headers };
}

export function formatErrorResponse(
  message: string,
  code: string,
  details: string | null,
  hint: string | null,
): PostgRESTError {
  return { message, code, details, hint };
}
