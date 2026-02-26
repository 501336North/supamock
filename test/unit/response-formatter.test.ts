import { describe, it, expect } from 'vitest';
import type { MockRecord, ResponseMeta } from '../../src/types.js';
import { formatResponse } from '../../src/response-formatter.js';

const records: MockRecord[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];
const meta: ResponseMeta = { total: 10, limit: 10, offset: 0 };

describe('formatResponse', () => {
  describe('REST mode', () => {
    it('should format REST response as { data: [...], meta: { total, limit, offset } }', () => {
      const result = formatResponse(records, meta, 'rest');

      expect(result.body).toEqual({
        data: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
        meta: { total: 10, limit: 10, offset: 0 },
      });
    });

    it('should not include Supabase headers in REST mode', () => {
      const result = formatResponse(records, meta, 'rest');

      expect(result.headers).not.toHaveProperty('Content-Range');
      expect(result.headers).not.toHaveProperty('X-Total-Count');
      expect(result.headers).toEqual({});
    });
  });

  describe('Supabase mode', () => {
    it('should format Supabase response as bare array', () => {
      const result = formatResponse(records, meta, 'supabase');

      expect(Array.isArray(result.body)).toBe(true);
      expect(result.body).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);
    });

    it('should include Content-Range header in Supabase mode', () => {
      const result = formatResponse(records, meta, 'supabase');

      expect(result.headers['Content-Range']).toBe('0-1/10');
    });

    it('should include X-Total-Count header in Supabase mode', () => {
      const result = formatResponse(records, meta, 'supabase');

      expect(result.headers['X-Total-Count']).toBe('10');
    });
  });
});
