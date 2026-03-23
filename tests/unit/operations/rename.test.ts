import { describe, it, expect, beforeAll } from 'vitest';
import { renameSymbolSource } from '../../../src/operations/rename.js';
import { registerBuiltinProviders } from '../../../src/languages/index.js';

beforeAll(() => {
  registerBuiltinProviders();
});

describe('renameSymbol', () => {
  describe('TypeScript', () => {
    it('renames a variable used 3 times', () => {
      const source = [
        'const count = 0;',
        'console.log(count);',
        'const next = count + 1;',
        '',
      ].join('\n');
      const result = renameSymbolSource(source, 'typescript', {
        kind: 'rename',
        from: 'count',
        to: 'total',
      });
      expect(result.editCount).toBe(3);
      expect(result.newSource).not.toContain('count');
      expect(result.newSource).toContain('total');
    });

    it('does not rename substrings of longer identifiers', () => {
      const source = [
        'const get = 1;',
        'const getName = 2;',
        'const getAge = 3;',
        'console.log(get);',
        '',
      ].join('\n');
      const result = renameSymbolSource(source, 'typescript', {
        kind: 'rename',
        from: 'get',
        to: 'fetch',
      });
      // Only exact identifier matches should be renamed
      expect(result.newSource).toContain('const fetch = 1');
      expect(result.newSource).toContain('console.log(fetch)');
      // Longer identifiers should be untouched
      expect(result.newSource).toContain('getName');
      expect(result.newSource).toContain('getAge');
    });

    it('renames only inside scope when scope is provided', () => {
      const source = [
        'const x = 1;',
        'function foo() {',
        '  const x = 2;',
        '  return x;',
        '}',
        'console.log(x);',
        '',
      ].join('\n');
      const result = renameSymbolSource(source, 'typescript', {
        kind: 'rename',
        from: 'x',
        to: 'y',
        scope: 'function foo() { $$$BODY }',
      });
      // Only x inside foo should be renamed
      expect(result.newSource).toMatch(/^const x = 1;/m);
      expect(result.newSource).toContain('console.log(x)');
      expect(result.newSource).toContain('const y = 2');
      expect(result.newSource).toContain('return y');
    });

    it('renames usages of a class name in expressions', () => {
      const source = [
        'class Foo {',
        '  constructor() {}',
        '}',
        'const instance = new Foo();',
        '',
      ].join('\n');
      const result = renameSymbolSource(source, 'typescript', {
        kind: 'rename',
        from: 'Foo',
        to: 'Bar',
      });
      // ast-grep findAll('Foo') finds identifier nodes (new Foo()),
      // but the class declaration name is a type_identifier —
      // it gets renamed because the editor checks both identifier kinds
      expect(result.newSource).toContain('new Bar()');
    });

    it('returns zero edits when identifier is not found', () => {
      const source = `const x = 1;\n`;
      const result = renameSymbolSource(source, 'typescript', {
        kind: 'rename',
        from: 'nonexistent',
        to: 'something',
      });
      expect(result.editCount).toBe(0);
    });
  });

  describe('Python', () => {
    it('renames a variable in Python source', () => {
      const source = [
        'count = 0',
        'print(count)',
        'count = count + 1',
        '',
      ].join('\n');
      const result = renameSymbolSource(source, 'python', {
        kind: 'rename',
        from: 'count',
        to: 'total',
      });
      expect(result.editCount).toBeGreaterThan(0);
      expect(result.newSource).toContain('total');
    });
  });
});
