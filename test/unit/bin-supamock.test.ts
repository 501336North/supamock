/**
 * CLI Binary Entry Point
 *
 * @behavior The bin/supamock module exists and can be imported
 * @business-rule The CLI entry point delegates to parseArgs and run from cli.ts
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('bin/supamock entry point', () => {
  it('should have a shebang line as the first line', () => {
    const filePath = resolve(
      import.meta.dirname,
      '../../src/bin/supamock.ts',
    );
    const content = readFileSync(filePath, 'utf-8');
    expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
  });

  it('should import parseArgs and run from cli module', () => {
    const filePath = resolve(
      import.meta.dirname,
      '../../src/bin/supamock.ts',
    );
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain("from '../cli.js'");
    expect(content).toContain('parseArgs');
    expect(content).toContain('run');
  });
});
