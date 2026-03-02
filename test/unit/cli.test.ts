/**
 * CLI Tests — Argument Parsing (Task 16) & Orchestration (Task 17)
 *
 * @behavior Parses CLI arguments into a structured config object
 * @business-rule Required --db flag must be provided; defaults apply for optional flags
 *
 * @behavior Orchestrates the full startup flow: connect → introspect → seed → serve
 * @business-rule Connection failures produce a clear user-facing error message
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Task 16: parseArgs tests
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  // Lazy import so we can rely on the module existing at test time
  let parseArgs: typeof import('../../src/cli.js').parseArgs;

  beforeEach(async () => {
    const mod = await import('../../src/cli.js');
    parseArgs = mod.parseArgs;
  });

  it('should require --db flag', () => {
    expect(() => parseArgs(['node', 'supamock'])).toThrow();
  });

  it('should parse --db connection string', () => {
    const config = parseArgs(['node', 'supamock', '--db', 'postgres://localhost/mydb']);
    expect(config.db).toBe('postgres://localhost/mydb');
  });

  it('should default port to 3210', () => {
    const config = parseArgs(['node', 'supamock', '--db', 'postgres://localhost/mydb']);
    expect(config.port).toBe(3210);
  });

  it('should parse --port 8080', () => {
    const config = parseArgs(['node', 'supamock', '--db', 'postgres://localhost/mydb', '--port', '8080']);
    expect(config.port).toBe(8080);
  });

  it('should default rows to 20', () => {
    const config = parseArgs(['node', 'supamock', '--db', 'postgres://localhost/mydb']);
    expect(config.rows).toBe(20);
  });

  it('should parse --rows 50', () => {
    const config = parseArgs(['node', 'supamock', '--db', 'postgres://localhost/mydb', '--rows', '50']);
    expect(config.rows).toBe(50);
  });

  it('should parse --tables users,posts', () => {
    const config = parseArgs(['node', 'supamock', '--db', 'postgres://localhost/mydb', '--tables', 'users,posts']);
    expect(config.tables).toEqual(['users', 'posts']);
  });

  it('should parse --schema custom_schema', () => {
    const config = parseArgs([
      'node', 'supamock', '--db', 'postgres://localhost/mydb', '--schema', 'custom_schema',
    ]);
    expect(config.schema).toBe('custom_schema');
  });

  it('should parse --seed 42', () => {
    const config = parseArgs(['node', 'supamock', '--db', 'postgres://localhost/mydb', '--seed', '42']);
    expect(config.seed).toBe(42);
  });

  it('should not have verbose property in config', () => {
    const config = parseArgs(['node', 'supamock', '--db', 'postgres://localhost/mydb']);
    expect(config).not.toHaveProperty('verbose');
  });

  // ─── Port validation ──────────────────────────────────────────────────────
  it('should throw for non-numeric port', () => {
    expect(() =>
      parseArgs(['node', 'supamock', '--db', 'postgres://localhost/mydb', '--port', 'abc']),
    ).toThrow(/Invalid port/);
  });

  it('should throw for negative port', () => {
    expect(() =>
      parseArgs(['node', 'supamock', '--db', 'postgres://localhost/mydb', '--port', '-1']),
    ).toThrow(/Invalid port/);
  });

  it('should throw for port exceeding 65535', () => {
    expect(() =>
      parseArgs(['node', 'supamock', '--db', 'postgres://localhost/mydb', '--port', '99999']),
    ).toThrow(/Invalid port/);
  });

  it('should throw for port 0', () => {
    expect(() =>
      parseArgs(['node', 'supamock', '--db', 'postgres://localhost/mydb', '--port', '0']),
    ).toThrow(/Invalid port/);
  });

  // ─── Rows validation ─────────────────────────────────────────────────────
  it('should throw for non-numeric rows', () => {
    expect(() =>
      parseArgs(['node', 'supamock', '--db', 'postgres://localhost/mydb', '--rows', 'abc']),
    ).toThrow(/Invalid rows/);
  });

  it('should throw for zero rows', () => {
    expect(() =>
      parseArgs(['node', 'supamock', '--db', 'postgres://localhost/mydb', '--rows', '0']),
    ).toThrow(/Invalid rows/);
  });

  it('should throw for negative rows', () => {
    expect(() =>
      parseArgs(['node', 'supamock', '--db', 'postgres://localhost/mydb', '--rows', '-5']),
    ).toThrow(/Invalid rows/);
  });

  // ─── Seed validation ─────────────────────────────────────────────────────
  it('should throw for non-numeric seed', () => {
    expect(() =>
      parseArgs(['node', 'supamock', '--db', 'postgres://localhost/mydb', '--seed', 'abc']),
    ).toThrow(/Invalid seed/);
  });
});

// ---------------------------------------------------------------------------
// Task 17: run orchestration tests
// ---------------------------------------------------------------------------

// Mock ALL collaborators before importing `run`
const mockPgClient = {
  connect: vi.fn(),
  end: vi.fn(),
};

vi.mock('pg', () => {
  class MockClient {
    connect = mockPgClient.connect;
    end = mockPgClient.end;
  }
  return {
    default: { Client: MockClient },
    Client: MockClient,
  };
});

vi.mock('../../src/schema/introspector.js', () => ({
  introspectSchema: vi.fn(),
}));

const mockStoreObj = {
  seed: vi.fn(),
  getSchema: vi.fn(() => ({ tables: [] })),
};

vi.mock('../../src/store/mock-store.js', () => {
  class MockMockStore {
    seed = mockStoreObj.seed;
    getSchema = mockStoreObj.getSchema;
  }
  return {
    MockStore: MockMockStore,
  };
});

vi.mock('../../src/server/server.js', () => ({
  createApp: vi.fn(() => ({ fake: 'express-app' })),
  startServer: vi.fn(),
  printStartupSummary: vi.fn(),
}));

describe('run', () => {
  let run: typeof import('../../src/cli.js').run;

  // Typed mock accessors
  let introspectSchema: Mock;
  let createApp: Mock;
  let startServer: Mock;
  let printStartupSummary: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();

    const introspectorMod = await import('../../src/schema/introspector.js');
    introspectSchema = introspectorMod.introspectSchema as unknown as Mock;

    const serverMod = await import('../../src/server/server.js');
    createApp = serverMod.createApp as unknown as Mock;
    startServer = serverMod.startServer as unknown as Mock;
    printStartupSummary = serverMod.printStartupSummary as unknown as Mock;

    // Default happy-path stubs
    mockPgClient.connect.mockResolvedValue(undefined);
    mockPgClient.end.mockResolvedValue(undefined);
    introspectSchema.mockResolvedValue({
      tables: [
        {
          name: 'users',
          columns: [],
          primaryKey: ['id'],
          foreignKeys: [],
        },
      ],
    });

    const cliMod = await import('../../src/cli.js');
    run = cliMod.run;
  });

  it('should connect, introspect, generate data, and start server in order', async () => {
    const callOrder: string[] = [];
    mockPgClient.connect.mockImplementation(() => {
      callOrder.push('connect');
      return Promise.resolve();
    });
    introspectSchema.mockImplementation(() => {
      callOrder.push('introspect');
      return Promise.resolve({
        tables: [{ name: 'users', columns: [], primaryKey: ['id'], foreignKeys: [] }],
      });
    });
    mockStoreObj.seed.mockImplementation(() => {
      callOrder.push('seed');
    });
    createApp.mockImplementation(() => {
      callOrder.push('createApp');
      return { fake: 'express-app' };
    });
    startServer.mockImplementation(() => {
      callOrder.push('startServer');
    });

    await run({
      db: 'postgres://localhost/test',
      port: 3210,
      rows: 20,
      schema: 'public',
    });

    expect(callOrder).toEqual(['connect', 'introspect', 'seed', 'createApp', 'startServer']);
    expect(introspectSchema).toHaveBeenCalledWith(expect.objectContaining({ connect: expect.any(Function) }), 'public');
    expect(mockStoreObj.seed).toHaveBeenCalledWith(20, undefined);
    expect(startServer).toHaveBeenCalled();
  });

  it('should exit with clear error when connection fails', async () => {
    mockPgClient.connect.mockRejectedValue(new Error('ECONNREFUSED'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    await run({
      db: 'postgres://bad-host/nope',
      port: 3210,
      rows: 20,
      schema: 'public',
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Could not connect to database'),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('should warn when no tables found', async () => {
    introspectSchema.mockResolvedValue({ tables: [] });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await run({
      db: 'postgres://localhost/empty',
      port: 3210,
      rows: 20,
      schema: 'public',
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No tables found'),
    );

    consoleSpy.mockRestore();
  });

  it('should filter tables when --tables flag is provided', async () => {
    introspectSchema.mockResolvedValue({
      tables: [
        { name: 'users', columns: [], primaryKey: ['id'], foreignKeys: [] },
        { name: 'posts', columns: [], primaryKey: ['id'], foreignKeys: [] },
        { name: 'comments', columns: [], primaryKey: ['id'], foreignKeys: [] },
      ],
    });

    // Verify filtered schema is passed to createApp via the store
    // The MockStore constructor receives the filtered schema.
    // We verify by checking what createApp receives -- the store instance
    // has a seed call which proves MockStore was constructed.
    // But we can verify by checking printStartupSummary which receives the schema directly.
    await run({
      db: 'postgres://localhost/test',
      port: 3210,
      rows: 20,
      schema: 'public',
      tables: ['users', 'posts'],
    });

    // printStartupSummary is called with the filtered schema
    expect(printStartupSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        tables: expect.arrayContaining([
          expect.objectContaining({ name: 'users' }),
          expect.objectContaining({ name: 'posts' }),
        ]),
      }),
      20,
    );

    // Verify 'comments' is NOT in the schema passed to printStartupSummary
    const calledSchema = (printStartupSummary as Mock).mock.calls[0]![0] as { tables: Array<{ name: string }> };
    const tableNames = calledSchema.tables.map((t) => t.name);
    expect(tableNames).toEqual(['users', 'posts']);
    expect(tableNames).not.toContain('comments');
  });
});
