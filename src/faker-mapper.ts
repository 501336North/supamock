import type { Faker } from '@faker-js/faker';
import type { ColumnMetadata } from './types.js';

// ─── Comment directive resolution ─────────────────────────────────────────────

function resolveComment(
  comment: string | null,
  fakerInstance: Faker,
): (() => unknown) | undefined {
  if (!comment) return undefined;

  const match = comment.match(/^faker:([a-zA-Z.]+)(?:\((.+)\))?$/);
  if (!match) return undefined;

  const path = match[1];
  const rawArgs = match[2];

  const segments = path.split('.');
  if (segments.length < 2) return undefined;

  let target: Record<string, unknown> = fakerInstance as unknown as Record<string, unknown>;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const next = target[segment];
    if (!next || typeof next !== 'object') {
      return undefined;
    }
    target = next as Record<string, unknown>;
  }

  const methodName = segments[segments.length - 1];
  const method = target[methodName];
  if (typeof method !== 'function') {
    return undefined;
  }

  if (rawArgs) {
    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(rawArgs);
    } catch {
      return undefined;
    }
    return () => (method as (opts: unknown) => unknown).call(target, parsedArgs);
  }

  return () => (method as () => unknown).call(target);
}

// ─── Column name heuristic resolution ─────────────────────────────────────────

interface NamePattern {
  pattern: RegExp;
  generator: (f: Faker) => () => unknown;
}

const NAME_PATTERNS: NamePattern[] = [
  {
    pattern: /^id$/i,
    generator: (f) => () => f.string.uuid(),
  },
  {
    pattern: /email/i,
    generator: (f) => () => f.internet.email(),
  },
  {
    pattern: /first.?name/i,
    generator: (f) => () => f.person.firstName(),
  },
  {
    pattern: /last.?name/i,
    generator: (f) => () => f.person.lastName(),
  },
  {
    pattern: /^name$/i,
    generator: (f) => () => f.person.fullName(),
  },
  {
    pattern: /phone/i,
    generator: (f) => () => f.phone.number(),
  },
  {
    pattern: /price|amount|cost|total/i,
    generator: (f) => () => f.commerce.price(),
  },
  {
    pattern: /avatar|image.?url/i,
    generator: (f) => () => f.image.url(),
  },
  {
    pattern: /url|website|homepage/i,
    generator: (f) => () => f.internet.url(),
  },
  {
    pattern: /city/i,
    generator: (f) => () => f.location.city(),
  },
  {
    pattern: /state/i,
    generator: (f) => () => f.location.state(),
  },
  {
    pattern: /zip|postal/i,
    generator: (f) => () => f.location.zipCode(),
  },
  {
    pattern: /country/i,
    generator: (f) => () => f.location.country(),
  },
  {
    pattern: /description|bio|about/i,
    generator: (f) => () => f.lorem.paragraph(),
  },
  {
    pattern: /title|subject/i,
    generator: (f) => () => f.lorem.sentence(),
  },
  {
    pattern: /username|user.?name/i,
    generator: (f) => () => f.internet.username(),
  },
  {
    pattern: /password/i,
    generator: (f) => () => f.internet.password(),
  },
  {
    pattern: /color/i,
    generator: (f) => () => f.color.human(),
  },
  {
    pattern: /company/i,
    generator: (f) => () => f.company.name(),
  },
  {
    pattern: /latitude|lat/i,
    generator: (f) => () => f.location.latitude(),
  },
  {
    pattern: /longitude|lng|lon/i,
    generator: (f) => () => f.location.longitude(),
  },
  {
    pattern: /created.?at|updated.?at|deleted.?at/i,
    generator: (f) => () => f.date.recent(),
  },
  {
    pattern: /is_.+|has_.+/i,
    generator: (f) => () => f.datatype.boolean(),
  },
  {
    pattern: /count|quantity|qty/i,
    generator: (f) => () => f.number.int({ min: 0, max: 1000 }),
  },
  {
    pattern: /rating|score/i,
    generator: (f) => () => f.number.int({ min: 1, max: 5 }),
  },
  {
    pattern: /slug/i,
    generator: (f) => () => f.helpers.slugify(f.lorem.words(3)).toLowerCase(),
  },
  {
    pattern: /token|hash/i,
    generator: (f) => () => f.string.alphanumeric(64),
  },
  // /ip/i must come after /description|bio|about/i, /zip|postal/i, and /shipping/i
  // to avoid false positives on words containing "ip" as a substring,
  // but before /address/i so "ip_address" matches here instead of address.
  {
    pattern: /ip/i,
    generator: (f) => () => f.internet.ipv4(),
  },
  {
    pattern: /address/i,
    generator: (f) => () => f.location.streetAddress(),
  },
];

function resolveColumnName(
  name: string,
  fakerInstance: Faker,
): (() => unknown) | undefined {
  for (const { pattern, generator } of NAME_PATTERNS) {
    if (pattern.test(name)) {
      return generator(fakerInstance);
    }
  }
  return undefined;
}

// ─── Enum / CHECK constraint resolution ───────────────────────────────────────

function resolveEnumValues(
  values: string[] | null,
  fakerInstance: Faker,
): (() => unknown) | undefined {
  if (!values || values.length === 0) return undefined;
  return () => fakerInstance.helpers.arrayElement(values);
}

// ─── Postgres type fallback ───────────────────────────────────────────────────

function resolveType(
  dataType: string,
  isNullable: boolean,
  fakerInstance: Faker,
): () => unknown {
  const normalized = dataType.toLowerCase();

  // UUID
  if (normalized === 'uuid') {
    return () => fakerInstance.string.uuid();
  }

  // Text / varchar / char
  if (
    normalized === 'text' ||
    normalized.startsWith('character varying') ||
    normalized.startsWith('varchar') ||
    normalized.startsWith('char')
  ) {
    return () => fakerInstance.lorem.sentence();
  }

  // Integer types
  if (
    normalized === 'integer' ||
    normalized === 'int' ||
    normalized === 'int4' ||
    normalized === 'smallint' ||
    normalized === 'int2' ||
    normalized === 'bigint' ||
    normalized === 'int8' ||
    normalized === 'serial' ||
    normalized === 'bigserial'
  ) {
    return () => fakerInstance.number.int({ min: 1, max: 10000 });
  }

  // Floating-point / decimal
  if (
    normalized === 'real' ||
    normalized === 'float4' ||
    normalized === 'double precision' ||
    normalized === 'float8' ||
    normalized === 'numeric' ||
    normalized.startsWith('decimal')
  ) {
    return () => fakerInstance.number.float({ min: 0, max: 10000, fractionDigits: 2 });
  }

  // Boolean
  if (normalized === 'boolean' || normalized === 'bool') {
    return () => fakerInstance.datatype.boolean();
  }

  // Timestamp / date / time types
  if (
    normalized === 'timestamp with time zone' ||
    normalized === 'timestamptz' ||
    normalized === 'timestamp without time zone' ||
    normalized === 'timestamp' ||
    normalized === 'date' ||
    normalized === 'time with time zone' ||
    normalized === 'time without time zone' ||
    normalized === 'time' ||
    normalized === 'timetz'
  ) {
    return () => fakerInstance.date.recent();
  }

  // JSON / JSONB
  if (normalized === 'json' || normalized === 'jsonb') {
    return () => ({});
  }

  // Array types
  if (normalized.endsWith('[]')) {
    return () => [];
  }

  // Inet / cidr
  if (normalized === 'inet' || normalized === 'cidr') {
    return () => fakerInstance.internet.ipv4();
  }

  // Catch-all
  if (isNullable) {
    return () => null;
  }
  return () => `<unsupported type: ${dataType}>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function mapColumn(
  column: ColumnMetadata,
  fakerInstance: Faker,
): () => unknown {
  return (
    resolveComment(column.comment, fakerInstance) ??
    resolveColumnName(column.name, fakerInstance) ??
    resolveEnumValues(column.checkConstraint, fakerInstance) ??
    resolveEnumValues(column.enumValues, fakerInstance) ??
    resolveType(column.dataType, column.isNullable, fakerInstance)
  );
}
