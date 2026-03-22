import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registry } from '../../src/core/language-registry.js';
import { typescriptProvider, tsxProvider } from '../../src/languages/typescript.js';
import { pythonProvider } from '../../src/languages/python.js';
import { querySource } from '../../src/engine/query.js';
import { applyEditToSource } from '../../src/engine/editor.js';

const tsFixturesDir = join(import.meta.dirname, '../fixtures/typescript');
const pyFixturesDir = join(import.meta.dirname, '../fixtures/python');

beforeAll(() => {
  if (!registry.has('typescript')) registry.register(typescriptProvider);
  if (!registry.has('tsx')) registry.register(tsxProvider);
  if (!registry.has('python')) registry.register(pythonProvider);
});

describe('Language Pipeline - TypeScript', () => {
  const simpleFunctions = readFileSync(join(tsFixturesDir, 'simple-functions.ts'), 'utf-8');
  const classes = readFileSync(join(tsFixturesDir, 'classes.ts'), 'utf-8');
  const importsExports = readFileSync(join(tsFixturesDir, 'imports-exports.ts'), 'utf-8');
  const commentsFormatting = readFileSync(join(tsFixturesDir, 'comments-formatting.ts'), 'utf-8');

  it('queries for functions and returns correct names', () => {
    const untyped = querySource(simpleFunctions, 'typescript', 'function $NAME($$$PARAMS) { $$$BODY }');
    const typed = querySource(simpleFunctions, 'typescript', 'function $NAME($$$PARAMS): $RET { $$$BODY }');
    const names = [...untyped, ...typed].map((m) => m.captures.NAME).filter(Boolean);
    expect(names).toContain('greet');
    expect(names).toContain('fetchData');
    expect(names).toContain('createUser');
  });

  it('queries for classes and returns correct names', () => {
    const matches = querySource(classes, 'typescript', 'class $NAME { $$$BODY }');
    const names = matches.map((m) => m.captures.NAME).filter(Boolean);
    expect(names).toContain('Animal');
  });

  it('queries for imports and returns module names', () => {
    const matches = querySource(importsExports, 'typescript', 'import { $$$NAMES } from $SOURCE');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const sources = matches.map((m) => m.captures.SOURCE).filter(Boolean);
    expect(sources.some((s) => s.includes('fs/promises'))).toBe(true);
  });

  it('renames a function and all references', () => {
    const result = applyEditToSource(simpleFunctions, 'typescript', {
      kind: 'rename',
      from: 'greet',
      to: 'sayHello',
    });
    expect(result.newSource).toContain('function sayHello');
    expect(result.newSource).not.toContain('greet');
    expect(result.syntaxValid).toBe(true);
  });

  it('replaces console.log with logger.info', () => {
    const result = applyEditToSource(simpleFunctions, 'typescript', {
      kind: 'replace',
      pattern: 'console.log($MSG)',
      replacement: 'logger.info($MSG)',
    });
    expect(result.newSource).not.toContain('console.log');
    expect(result.newSource).toContain('logger.info');
    expect(result.syntaxValid).toBe(true);
  });

  it('preserves comments and formatting after edit', () => {
    const result = applyEditToSource(commentsFormatting, 'typescript', {
      kind: 'replace',
      pattern: 'console.log($MSG)',
      replacement: 'logger.info($MSG)',
    });

    expect(result.newSource).toContain('// Line comment at the top');
    expect(result.newSource).toContain('* JSDoc block comment');
    expect(result.newSource).toContain('/* Multi-line');
    expect(result.newSource).toContain('// inline comment');
    expect(result.newSource).toContain('// Tab-indented comment');
    expect(result.newSource).toContain('const   spacey   =   "extra    spaces"');
    expect(result.newSource).toContain('\n\n\n');
    expect(result.syntaxValid).toBe(true);
  });
});

describe('Language Pipeline - TSX', () => {
  const jsxComponent = readFileSync(join(tsFixturesDir, 'jsx-component.tsx'), 'utf-8');

  it('parses .tsx file and finds components', () => {
    const matches = querySource(jsxComponent, 'tsx', 'function $NAME($$$PARAMS) { $$$BODY }');
    const names = matches.map((m) => m.captures.NAME).filter(Boolean);
    expect(names).toContain('Card');
  });

  it('replaces console.log in TSX file preserving JSX', () => {
    const result = applyEditToSource(jsxComponent, 'tsx', {
      kind: 'replace',
      pattern: 'console.log($MSG)',
      replacement: 'logger.info($MSG)',
    });
    expect(result.newSource).not.toContain('console.log');
    expect(result.newSource).toContain('logger.info');
    expect(result.newSource).toContain('<button');
    expect(result.newSource).toContain('<div className="card">');
    expect(result.syntaxValid).toBe(true);
  });

  it('renames component in TSX file', () => {
    const result = applyEditToSource(jsxComponent, 'tsx', {
      kind: 'rename',
      from: 'Button',
      to: 'PrimaryButton',
    });
    expect(result.newSource).toContain('PrimaryButton');
    expect(result.syntaxValid).toBe(true);
  });
});

describe('Language Pipeline - Python', () => {
  const simpleFunctions = readFileSync(join(pyFixturesDir, 'simple-functions.py'), 'utf-8');
  const classes = readFileSync(join(pyFixturesDir, 'classes.py'), 'utf-8');
  const imports = readFileSync(join(pyFixturesDir, 'imports.py'), 'utf-8');
  const indentation = readFileSync(join(pyFixturesDir, 'indentation.py'), 'utf-8');

  it('queries for functions and returns correct names', () => {
    const matches = querySource(simpleFunctions, 'python', 'def $NAME($$$PARAMS)');
    const names = matches.map((m) => m.captures.NAME).filter(Boolean);
    expect(names).toContain('greet');
    expect(names).toContain('add');
    expect(names).toContain('create_user');
  });

  it('queries for classes and returns correct names', () => {
    const matches = querySource(classes, 'python', 'class $NAME');
    const names = matches.map((m) => m.captures.NAME).filter(Boolean);
    expect(names).toContain('Animal');
    expect(names).toContain('Dog');
  });

  it('queries for imports', () => {
    const matches = querySource(imports, 'python', 'import $MODULE');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renames a function and all references', () => {
    const result = applyEditToSource(simpleFunctions, 'python', {
      kind: 'rename',
      from: 'greet',
      to: 'say_hello',
    });
    expect(result.newSource).toContain('def say_hello');
    expect(result.newSource).not.toMatch(/\bgreet\b/);
    expect(result.syntaxValid).toBe(true);
  });

  it('replaces print with logging.info', () => {
    const result = applyEditToSource(simpleFunctions, 'python', {
      kind: 'replace',
      pattern: 'print($MSG)',
      replacement: 'logging.info($MSG)',
    });
    expect(result.newSource).toContain('logging.info');
    expect(result.editCount).toBeGreaterThanOrEqual(2);
  });

  it('preserves Python indentation after edit in nested context', () => {
    const result = applyEditToSource(indentation, 'python', {
      kind: 'replace',
      pattern: 'print($MSG)',
      replacement: 'logging.info($MSG)',
    });
    expect(result.newSource).toContain('class Processor');
    expect(result.newSource).toContain('    def __init__');
    expect(result.newSource).toContain('        self.items = items');
    expect(result.syntaxValid).toBe(true);
  });

  it('byte-level formatting preservation in Python', () => {
    const result = applyEditToSource(indentation, 'python', {
      kind: 'replace',
      pattern: 'print($MSG)',
      replacement: 'logging.info($MSG)',
    });
    const originalLines = indentation.split('\n');
    const newLines = result.newSource.split('\n');
    expect(newLines[0]).toBe(originalLines[0]);
    expect(newLines[1]).toBe(originalLines[1]);
  });
});
