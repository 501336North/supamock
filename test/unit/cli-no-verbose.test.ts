/**
 * CLI Config - No verbose option
 *
 * @behavior The CLIConfig interface should not have a verbose property
 * @business-rule The verbose flag was declared but never consumed; dead code should be removed
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('CLI verbose removal', () => {
  it('should not declare verbose in CLIConfig interface', () => {
    const cliPath = resolve(import.meta.dirname, '../../src/cli.ts');
    const cliSource = readFileSync(cliPath, 'utf-8');

    // Extract the CLIConfig interface block
    const interfaceMatch = cliSource.match(
      /export interface CLIConfig \{([^}]+)\}/,
    );
    expect(interfaceMatch).not.toBeNull();
    const interfaceBody = interfaceMatch![1]!;
    expect(interfaceBody).not.toContain('verbose');
  });

  it('should not have --verbose option in commander setup', () => {
    const cliPath = resolve(import.meta.dirname, '../../src/cli.ts');
    const cliSource = readFileSync(cliPath, 'utf-8');

    expect(cliSource).not.toContain('--verbose');
    expect(cliSource).not.toContain("'-v,");
  });

  it('should not include verbose in parseArgs return value', async () => {
    const { parseArgs } = await import('../../src/cli.js');
    const config = parseArgs(['node', 'supamock', '--db', 'postgres://localhost/test']);
    expect(config).not.toHaveProperty('verbose');
  });
});
