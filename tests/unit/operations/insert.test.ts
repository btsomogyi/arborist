import { describe, it, expect, beforeAll } from 'vitest';
import { insertContentSource } from '../../../src/operations/insert.js';
import { registerBuiltinProviders } from '../../../src/languages/index.js';

beforeAll(() => {
  registerBuiltinProviders();
});

describe('insertContent', () => {
  describe('TypeScript', () => {
    it('inserts content before a function', () => {
      const source = [
        'function greet() {',
        '  return "hello";',
        '}',
        '',
      ].join('\n');
      const result = insertContentSource(source, 'typescript', {
        kind: 'insert',
        anchor: 'function greet() { $$$BODY }',
        position: 'before',
        content: '// This is a greeting function',
      });
      expect(result.editCount).toBe(1);
      const lines = result.newSource.split('\n');
      const commentIndex = lines.findIndex(l => l.includes('// This is a greeting function'));
      const fnIndex = lines.findIndex(l => l.includes('function greet()'));
      expect(commentIndex).toBeLessThan(fnIndex);
    });

    it('inserts content after a function', () => {
      const source = [
        'function greet() {',
        '  return "hello";',
        '}',
        '',
      ].join('\n');
      const result = insertContentSource(source, 'typescript', {
        kind: 'insert',
        anchor: 'function greet() { $$$BODY }',
        position: 'after',
        content: '// End of greeting function',
      });
      expect(result.editCount).toBe(1);
      const lines = result.newSource.split('\n');
      const closingIndex = lines.findIndex(l => l.trim() === '}');
      const commentIndex = lines.findIndex(l => l.includes('// End of greeting function'));
      expect(commentIndex).toBeGreaterThan(closingIndex);
    });

    it('prepends content inside a function body', () => {
      const source = [
        'function greet() {',
        '  return "hello";',
        '}',
        '',
      ].join('\n');
      const result = insertContentSource(source, 'typescript', {
        kind: 'insert',
        anchor: 'function greet() { $$$BODY }',
        position: 'prepend',
        content: 'console.log("entering greet");',
      });
      expect(result.editCount).toBe(1);
      expect(result.newSource).toContain('console.log("entering greet")');
      // The prepended content should be inside the function
      const fnStart = result.newSource.indexOf('function greet()');
      const logPos = result.newSource.indexOf('console.log("entering greet")');
      const returnPos = result.newSource.indexOf('return "hello"');
      expect(logPos).toBeGreaterThan(fnStart);
      expect(logPos).toBeLessThan(returnPos);
    });

    it('appends content inside a class body', () => {
      const source = [
        'class Foo {',
        '  bar() {}',
        '}',
        '',
      ].join('\n');
      const result = insertContentSource(source, 'typescript', {
        kind: 'insert',
        anchor: 'class Foo { $$$BODY }',
        position: 'append',
        content: 'baz() { return 42; }',
      });
      expect(result.editCount).toBe(1);
      expect(result.newSource).toContain('baz()');
      // baz should be before the closing brace
      const bazPos = result.newSource.indexOf('baz()');
      const lastBrace = result.newSource.lastIndexOf('}');
      expect(bazPos).toBeLessThan(lastBrace);
    });

    it('inserts multi-line content with correct indentation', () => {
      const source = [
        'function greet() {',
        '  return "hello";',
        '}',
        '',
      ].join('\n');
      const result = insertContentSource(source, 'typescript', {
        kind: 'insert',
        anchor: 'function greet() { $$$BODY }',
        position: 'before',
        content: '/**\n * Greeting function.\n */',
      });
      expect(result.editCount).toBe(1);
      expect(result.newSource).toContain('/**');
      expect(result.newSource).toContain(' * Greeting function.');
    });
  });

  describe('Python', () => {
    it('inserts content before a function in Python', () => {
      const source = [
        'def greet():',
        '    return "hello"',
        '',
      ].join('\n');
      const result = insertContentSource(source, 'python', {
        kind: 'insert',
        anchor: 'def greet($$$PARAMS)',
        position: 'before',
        content: '# Greeting function',
      });
      expect(result.editCount).toBe(1);
      const lines = result.newSource.split('\n');
      const commentIndex = lines.findIndex(l => l.includes('# Greeting function'));
      const defIndex = lines.findIndex(l => l.includes('def greet'));
      expect(commentIndex).toBeLessThan(defIndex);
    });
  });
});
