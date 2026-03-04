import type {
  PostgRESTQuery,
  SelectClause,
  EmbedClause,
  Filter,
  FilterOperator,
  OrderClause,
  PreferHeader,
} from '../types.js';

const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset']);

const VALID_OPERATORS = new Set<FilterOperator>([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is',
]);

function parseSelect(raw: string | undefined): SelectClause {
  if (raw === undefined || raw === '*') {
    return { columns: '*', embeds: [] };
  }

  const columns: string[] = [];
  const embeds: EmbedClause[] = [];

  // We need to split on commas that are NOT inside parentheses.
  const parts = splitTopLevel(raw);

  for (const part of parts) {
    const embedMatch = part.match(/^(\w+)\((.+)\)$/);
    if (embedMatch) {
      const relation = embedMatch[1]!;
      const innerRaw = embedMatch[2]!;
      const embedColumns: string[] | '*' =
        innerRaw === '*' ? '*' : innerRaw.split(',');
      embeds.push({ relation, columns: embedColumns });
    } else {
      columns.push(part);
    }
  }

  // If the only "columns" we found are all embeds and there was a *, treat as '*'
  if (columns.length === 1 && columns[0] === '*') {
    return { columns: '*', embeds };
  }

  return { columns, embeds };
}

function splitTopLevel(input: string): string[] {
  const results: string[] = [];
  let depth = 0;
  let current = '';

  for (const ch of input) {
    if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      results.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.length > 0) {
    results.push(current);
  }

  return results;
}

function parseOrder(raw: string | undefined): OrderClause[] {
  if (raw === undefined) {
    return [];
  }

  return raw.split(',').map((segment) => {
    const dotIndex = segment.lastIndexOf('.');
    const column = segment.slice(0, dotIndex);
    const dirStr = segment.slice(dotIndex + 1);
    if (dirStr !== 'asc' && dirStr !== 'desc') {
      throw new Error(
        `Invalid sort direction: "${dirStr}". Must be "asc" or "desc".`,
      );
    }
    const direction = dirStr;
    return { column, direction };
  });
}

function parseFilterValue(
  operator: FilterOperator,
  rawValue: string,
): string | string[] | null {
  if (operator === 'in') {
    // Strip surrounding parentheses: "(admin,editor)" -> "admin,editor"
    const inner = rawValue.slice(1, -1);
    return inner.split(',');
  }
  if (operator === 'is' && rawValue === 'null') {
    return null;
  }
  return rawValue;
}

function parseFilters(query: Record<string, string>): Filter[] {
  const filters: Filter[] = [];

  for (const [key, value] of Object.entries(query)) {
    if (RESERVED_PARAMS.has(key)) {
      continue;
    }

    const dotIndex = value.indexOf('.');
    if (dotIndex === -1) {
      continue;
    }

    const operatorStr = value.slice(0, dotIndex);
    const rawValue = value.slice(dotIndex + 1);

    if (!VALID_OPERATORS.has(operatorStr as FilterOperator)) {
      throw new Error(
        `Unknown filter operator: "${operatorStr}". Valid operators are: ${[...VALID_OPERATORS].join(', ')}`,
      );
    }

    const operator = operatorStr as FilterOperator;
    const parsedValue = parseFilterValue(operator, rawValue);

    filters.push({ column: key, operator, value: parsedValue });
  }

  return filters;
}

export function parsePreferHeader(
  header: string | undefined,
): PreferHeader {
  if (header === undefined) {
    return {};
  }

  const result: PreferHeader = {};
  const parts = header.split(',').map((p) => p.trim());

  for (const part of parts) {
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    const key = part.slice(0, eqIndex);
    const val = part.slice(eqIndex + 1);

    if (key === 'count' && val === 'exact') {
      result.count = 'exact';
    } else if (
      key === 'return' &&
      (val === 'representation' || val === 'minimal')
    ) {
      result.return = val;
    }
  }

  return result;
}

export function parseQuery(
  query: Record<string, string>,
  preferHeader?: string,
): PostgRESTQuery {
  const select = parseSelect(query['select']);
  const order = parseOrder(query['order']);
  const rawLimit = query['limit'] !== undefined ? Number(query['limit']) : 0;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 0;
  const rawOffset = query['offset'] !== undefined ? Number(query['offset']) : 0;
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;
  const filters = parseFilters(query);
  const prefer = parsePreferHeader(preferHeader);

  return {
    select,
    filters,
    order,
    limit,
    offset,
    prefer,
  };
}
