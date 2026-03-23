import { describe, it, expect, beforeAll } from 'vitest';
import { structuralReplaceSource } from '../../../src/operations/replace.js';
import { registerBuiltinProviders } from '../../../src/languages/index.js';
import type { StructuralReplace } from '../../../src/core/types.js';

beforeAll(() => {
  registerBuiltinProviders();
});

describe('structuralReplace', () => {
  describe('TypeScript', () => {
    it('replaces a simple pattern with no captures', () => {
      const source = `const x = 1;\nconst y = 2;\n`;
      const result = structuralReplaceSource(source, 'typescript', {
        kind: 'replace',
        pattern: 'const y = 2',
        replacement: 'const y = 99',
      });
      expect(result.editCount).toBe(1);
      expect(result.newSource).toContain('const y = 99');
      expect(result.newSource).toContain('const x = 1');
    });

    it('replaces with single capture ($MSG)', () => {
      const source = `console.log("hello");\nconsole.log("world");\n`;
      const result = structuralReplaceSource(source, 'typescript', {
        kind: 'replace',
        pattern: 'console.log($MSG)',
        replacement: 'logger.info($MSG)',
      });
      expect(result.editCount).toBe(2);
      expect(result.newSource).toContain('logger.info("hello")');
      expect(result.newSource).toContain('logger.info("world")');
      expect(result.newSource).not.toContain('console.log');
    });

    it('replaces with variadic capture ($$$ARGS)', () => {
      const source = `console.log("a", 1, true);\n`;
      const result = structuralReplaceSource(source, 'typescript', {
        kind: 'replace',
        pattern: 'console.log($$$ARGS)',
        replacement: 'logger.info($$$ARGS)',
      });
      expect(result.editCount).toBe(1);
      // Variadic captures may not preserve original whitespace between args
      expect(result.newSource).toContain('logger.info(');
      expect(result.newSource).toContain('"a"');
      expect(result.newSource).not.toContain('console.log');
    });

    it('replaces only the Nth match when matchIndex is set', () => {
      const source = `console.log("a");\nconsole.log("b");\nconsole.log("c");\n`;
      const result = structuralReplaceSource(source, 'typescript', {
        kind: 'replace',
        pattern: 'console.log($MSG)',
        replacement: 'logger.info($MSG)',
        matchIndex: 1,
      });
      expect(result.editCount).toBe(1);
      expect(result.newSource).toContain('console.log("a")');
      expect(result.newSource).toContain('logger.info("b")');
      expect(result.newSource).toContain('console.log("c")');
    });

    it('replaces only inside scope when scope is set', () => {
      const source = [
        'function foo() {',
        '  console.log("inside");',
        '}',
        'console.log("outside");',
        '',
      ].join('\n');
      const result = structuralReplaceSource(source, 'typescript', {
        kind: 'replace',
        pattern: 'console.log($MSG)',
        replacement: 'logger.info($MSG)',
        scope: 'function foo() { $$$BODY }',
      });
      expect(result.editCount).toBe(1);
      expect(result.newSource).toContain('logger.info("inside")');
      expect(result.newSource).toContain('console.log("outside")');
    });

    it('preserves formatting around replacements', () => {
      const source = `const x = oldValue;\nconst y = oldValue;\n`;
      const result = structuralReplaceSource(source, 'typescript', {
        kind: 'replace',
        pattern: 'oldValue',
        replacement: 'newValue',
      });
      expect(result.newSource).toContain('const x = newValue');
      expect(result.newSource).toContain('const y = newValue');
    });

    it('returns zero edits for non-matching pattern', () => {
      const source = `const x = 1;\n`;
      const result = structuralReplaceSource(source, 'typescript', {
        kind: 'replace',
        pattern: 'nonexistent($X)',
        replacement: 'replaced($X)',
      });
      expect(result.editCount).toBe(0);
      expect(result.newSource).toBe(source);
    });
  });

  describe('Python', () => {
    it('replaces print calls with logging calls', () => {
      const source = `print("hello")\nprint("world")\n`;
      const result = structuralReplaceSource(source, 'python', {
        kind: 'replace',
        pattern: 'print($MSG)',
        replacement: 'logging.info($MSG)',
      });
      expect(result.editCount).toBe(2);
      expect(result.newSource).toContain('logging.info("hello")');
      expect(result.newSource).toContain('logging.info("world")');
    });
  });
});
