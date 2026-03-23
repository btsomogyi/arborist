import { describe, it, expect, beforeAll } from 'vitest';
import { removeNodeSource } from '../../../src/operations/remove.js';
import { registerBuiltinProviders } from '../../../src/languages/index.js';

beforeAll(() => {
  registerBuiltinProviders();
});

describe('removeNode', () => {
  describe('TypeScript', () => {
    it('removes a single statement', () => {
      const source = [
        'const x = 1;',
        'const y = 2;',
        'const z = 3;',
        '',
      ].join('\n');
      const result = removeNodeSource(source, 'typescript', {
        kind: 'remove',
        pattern: 'const y = 2',
      });
      expect(result.editCount).toBe(1);
      expect(result.newSource).not.toContain('const y = 2');
      expect(result.newSource).toContain('const x = 1');
      expect(result.newSource).toContain('const z = 3');
    });

    it('removes a function', () => {
      const source = [
        'function foo() {',
        '  return 1;',
        '}',
        '',
        'function bar() {',
        '  return 2;',
        '}',
        '',
      ].join('\n');
      const result = removeNodeSource(source, 'typescript', {
        kind: 'remove',
        pattern: 'function foo() { $$$BODY }',
      });
      expect(result.editCount).toBe(1);
      expect(result.newSource).not.toContain('function foo');
      expect(result.newSource).toContain('function bar');
    });

    it('removes an import statement with line cleanup', () => {
      const source = [
        'import { readFile } from "fs";',
        'import { join } from "path";',
        '',
        'const x = 1;',
        '',
      ].join('\n');
      const result = removeNodeSource(source, 'typescript', {
        kind: 'remove',
        pattern: 'import { readFile } from "fs"',
      });
      expect(result.editCount).toBe(1);
      expect(result.newSource).not.toContain('readFile');
      expect(result.newSource).toContain('import { join } from "path"');
    });

    it('removes only the Nth match when matchIndex is set', () => {
      const source = [
        'console.log("a");',
        'console.log("b");',
        'console.log("c");',
        '',
      ].join('\n');
      const result = removeNodeSource(source, 'typescript', {
        kind: 'remove',
        pattern: 'console.log($MSG)',
        matchIndex: 1,
      });
      expect(result.editCount).toBe(1);
      expect(result.newSource).toContain('console.log("a")');
      expect(result.newSource).not.toContain('console.log("b")');
      expect(result.newSource).toContain('console.log("c")');
    });

    it('handles whitespace cleanup when node is sole content on line', () => {
      const source = [
        'function foo() {',
        '  console.log("debug");',
        '  return 42;',
        '}',
        '',
      ].join('\n');
      const result = removeNodeSource(source, 'typescript', {
        kind: 'remove',
        pattern: 'console.log($MSG)',
      });
      expect(result.editCount).toBe(1);
      // The line with console.log should be fully removed
      expect(result.newSource).not.toContain('console.log');
      expect(result.newSource).toContain('return 42');
    });

    it('returns zero edits for non-matching pattern', () => {
      const source = `const x = 1;\n`;
      const result = removeNodeSource(source, 'typescript', {
        kind: 'remove',
        pattern: 'nonexistent($X)',
      });
      expect(result.editCount).toBe(0);
      expect(result.newSource).toBe(source);
    });
  });

  describe('Python', () => {
    it('removes a print call in Python', () => {
      const source = [
        'x = 1',
        'print(x)',
        'y = 2',
        '',
      ].join('\n');
      const result = removeNodeSource(source, 'python', {
        kind: 'remove',
        pattern: 'print($MSG)',
      });
      expect(result.editCount).toBe(1);
      expect(result.newSource).not.toContain('print');
      expect(result.newSource).toContain('x = 1');
      expect(result.newSource).toContain('y = 2');
    });
  });
});
