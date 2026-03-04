/**
 * Public API Exports
 *
 * @behavior The package entry point re-exports all public classes, functions, and types
 * @business-rule Consumers can import everything they need from the top-level package
 */

import { describe, it, expect } from 'vitest';
import * as supamock from '../../src/index.js';

describe('Public API exports', () => {
  it('exports MockStore class', () => {
    expect(supamock.MockStore).toBeDefined();
    expect(typeof supamock.MockStore).toBe('function');
  });

  it('exports createApp function', () => {
    expect(supamock.createApp).toBeDefined();
    expect(typeof supamock.createApp).toBe('function');
  });

  it('exports startServer function', () => {
    expect(supamock.startServer).toBeDefined();
    expect(typeof supamock.startServer).toBe('function');
  });

  it('exports introspectSchema function', () => {
    expect(supamock.introspectSchema).toBeDefined();
    expect(typeof supamock.introspectSchema).toBe('function');
  });

  it('exports parseArgs function', () => {
    expect(supamock.parseArgs).toBeDefined();
    expect(typeof supamock.parseArgs).toBe('function');
  });

  it('exports run function', () => {
    expect(supamock.run).toBeDefined();
    expect(typeof supamock.run).toBe('function');
  });
});
