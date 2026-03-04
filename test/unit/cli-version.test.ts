/**
 * CLI Version Synchronization
 *
 * @behavior The CLI --version output matches the version in package.json
 * @business-rule A single source of truth for the version string avoids drift
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('CLI version', () => {
  it('should read version from package.json, not a hardcoded string', () => {
    const cliPath = resolve(import.meta.dirname, '../../src/cli.ts');
    const cliSource = readFileSync(cliPath, 'utf-8');

    // The source must NOT contain a hardcoded version string like .version('0.1.0')
    expect(cliSource).not.toMatch(/\.version\(['"][0-9]+\.[0-9]+\.[0-9]+['"]\)/);
  });

  it('should use createRequire to load package.json version', () => {
    const cliPath = resolve(import.meta.dirname, '../../src/cli.ts');
    const cliSource = readFileSync(cliPath, 'utf-8');

    expect(cliSource).toContain('createRequire');
    expect(cliSource).toContain('package.json');
  });
});
