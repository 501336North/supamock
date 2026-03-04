import { faker } from '@faker-js/faker';
import type { ColumnInfo } from '../types.js';

/**
 * Maps a column name (case-insensitive) to a Faker.js generator function.
 * Returns a generator based on name heuristics first, then type fallbacks.
 * Returns null for unsupported types.
 */
export function mapColumn(column: ColumnInfo): (() => unknown) | null {
  // 1. Enum columns get priority
  if (column.isEnum && column.enumValues.length > 0) {
    return () => faker.helpers.arrayElement(column.enumValues);
  }

  // 2. Name-based heuristics (case-insensitive)
  const nameGenerator = mapByName(column.name);
  if (nameGenerator) {
    return nameGenerator;
  }

  // 3. Type-based fallbacks
  return mapByType(column.type);
}

function mapByName(name: string): (() => unknown) | null {
  const lower = name.toLowerCase();

  if (lower === 'email') return () => faker.internet.email();
  if (lower === 'first_name' || lower === 'firstname') return () => faker.person.firstName();
  if (lower === 'last_name' || lower === 'lastname') return () => faker.person.lastName();
  if (lower === 'name') return () => faker.person.fullName();
  if (lower === 'phone' || lower === 'phone_number') return () => faker.phone.number();
  if (lower === 'avatar_url' || lower === 'avatar') return () => faker.image.avatar();
  if (lower === 'url' || lower === 'website') return () => faker.internet.url();
  if (lower === 'username') return () => faker.internet.username();
  if (lower === 'title') return () => faker.lorem.sentence();
  if (lower === 'body' || lower === 'content' || lower === 'description')
    return () => faker.lorem.paragraphs(2);
  if (lower === 'address') return () => faker.location.streetAddress();
  if (lower === 'city') return () => faker.location.city();
  if (lower === 'country') return () => faker.location.country();
  if (lower === 'zip' || lower === 'postal_code') return () => faker.location.zipCode();
  if (lower === 'company' || lower === 'organization') return () => faker.company.name();

  return null;
}

function mapByType(type: string): (() => unknown) | null {
  const lower = type.toLowerCase();

  switch (lower) {
    case 'text':
    case 'varchar':
    case 'character varying':
      return () => faker.lorem.sentence();

    case 'integer':
    case 'int4':
    case 'int8':
    case 'bigint':
    case 'smallint':
      return () => faker.number.int({ min: 1, max: 10000 });

    case 'numeric':
    case 'decimal':
    case 'float4':
    case 'float8':
    case 'double precision':
    case 'real':
      return () => faker.number.float({ min: 0, max: 1000, fractionDigits: 2 });

    case 'boolean':
    case 'bool':
      return () => faker.datatype.boolean();

    case 'uuid':
      return () => faker.string.uuid();

    case 'timestamptz':
    case 'timestamp':
    case 'timestamp without time zone':
    case 'timestamp with time zone':
      return () => faker.date.recent().toISOString();

    case 'date':
      return () => faker.date.recent().toISOString().split('T')[0];

    case 'jsonb':
    case 'json':
      return () => ({});

    default:
      return null;
  }
}
