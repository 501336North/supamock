import type { MockRecord, ResponseMeta, FormattedResponse } from './types.js';

export function formatResponse(
  records: MockRecord[],
  meta: ResponseMeta,
  format: 'rest' | 'supabase'
): FormattedResponse {
  if (format === 'supabase') {
    return formatSupabase(records, meta);
  }
  return formatRest(records, meta);
}

function formatRest(
  records: MockRecord[],
  meta: ResponseMeta
): FormattedResponse {
  return {
    body: {
      data: records,
      meta: { total: meta.total, limit: meta.limit, offset: meta.offset },
    },
    headers: {},
  };
}

function formatSupabase(
  records: MockRecord[],
  meta: ResponseMeta
): FormattedResponse {
  const rangeEnd = records.length > 0 ? meta.offset + records.length - 1 : 0;

  return {
    body: records,
    headers: {
      'Content-Range': `${meta.offset}-${rangeEnd}/${meta.total}`,
      'X-Total-Count': String(meta.total),
    },
  };
}
