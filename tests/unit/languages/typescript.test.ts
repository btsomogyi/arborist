import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { typescriptProvider, tsxProvider } from '../../../src/languages/typescript.js';
import { registry } from '../../../src/core/language-registry.js';
import { querySource } from '../../../src/engine/query.js';
import { parseLangSource, sgNodeToASTNode } from '../../../src/engine/parser.js';

const fixturesDir = join(import.meta.dirname, '../../fixtures/typescript');

beforeAll(() => {
  if (!registry.has('typescript')) registry.register(typescriptProvider);
  if (!registry.has('tsx')) registry.register(tsxProvider);
});

describe('typescriptProvider - metadata', () => {
  it('has correct id', () => {
    expect(typescriptProvider.id).toBe('typescript');
  });

  it('has correct displayName', () => {
    expect(typescriptProvider.displayName).toBe('TypeScript');
  });

  it('has correct extensions', () => {
    expect(typescriptProvider.extensions).toContain('.ts');
    expect(typescriptProvider.extensions).toContain('.js');
    expect(typescriptProvider.extensions).toContain('.mjs');
    expect(typescriptProvider.extensions).toContain('.cjs');
  });

  it('has correct astGrepLang', () => {
    expect(typescriptProvider.astGrepLang).toBe('TypeScript');
  });

  it('has non-empty node type arrays', () => {
    for (const [key, types] of Object.entries(typescriptProvider.nodeTypes)) {
      expect(types.length, `nodeTypes.${key} should not be empty`).toBeGreaterThan(0);
    }
  });
});

describe('tsxProvider - metadata', () => {
  it('has correct id and extensions', () => {
    expect(tsxProvider.id).toBe('tsx');
    expect(tsxProvider.extensions).toContain('.tsx');
    expect(tsxProvider.extensions).toContain('.jsx');
  });

  it('has correct astGrepLang', () => {
    expect(tsxProvider.astGrepLang).toBe('Tsx');
  });

  it('inherits TypeScript patterns', () => {
    expect(tsxProvider.patterns.functionDeclaration).toBe(typescriptProvider.patterns.functionDeclaration);
  });

  it('has JSX-specific patterns', () => {
    expect(tsxProvider.patterns.jsxElement).toBeDefined();
    expect(tsxProvider.patterns.jsxSelfClosing).toBeDefined();
  });
});

describe('typescriptProvider - patterns match against fixtures', () => {
  const simpleFunctions = readFileSync(join(fixturesDir, 'simple-functions.ts'), 'utf-8');
  const classes = readFileSync(join(fixturesDir, 'classes.ts'), 'utf-8');
  const importsExports = readFileSync(join(fixturesDir, 'imports-exports.ts'), 'utf-8');

  it('functionDeclaration matches (typed + untyped combined)', () => {
    const untyped = querySource(simpleFunctions, 'typescript', typescriptProvider.patterns.functionDeclaration);
    const typed = querySource(simpleFunctions, 'typescript', typescriptProvider.patterns.typedFunctionDeclaration);
    expect(untyped.length + typed.length).toBeGreaterThanOrEqual(3);
  });

  it('typedFunctionDeclaration captures function names', () => {
    const matches = querySource(simpleFunctions, 'typescript', typescriptProvider.patterns.typedFunctionDeclaration);
    expect(matches.length).toBeGreaterThanOrEqual(2);
    const names = matches.map((m) => m.captures.NAME).filter(Boolean);
    expect(names).toContain('greet');
  });

  it('arrowFunction or typedArrowFunction matches', () => {
    const untyped = querySource(simpleFunctions, 'typescript', typescriptProvider.patterns.arrowFunction);
    const typed = querySource(simpleFunctions, 'typescript', typescriptProvider.patterns.typedArrowFunction);
    expect(untyped.length + typed.length).toBeGreaterThanOrEqual(1);
  });

  it('asyncFunction or typedAsyncFunction matches', () => {
    const untyped = querySource(simpleFunctions, 'typescript', typescriptProvider.patterns.asyncFunction);
    const typed = querySource(simpleFunctions, 'typescript', typescriptProvider.patterns.typedAsyncFunction);
    expect(untyped.length + typed.length).toBeGreaterThanOrEqual(1);
  });

  it('classDeclaration matches classes', () => {
    const matches = querySource(classes, 'typescript', typescriptProvider.patterns.classDeclaration);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('classWithExtends matches extended classes', () => {
    const matches = querySource(classes, 'typescript', typescriptProvider.patterns.classWithExtends);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].captures.NAME).toBe('Dog');
    expect(matches[0].captures.BASE).toBe('Animal');
  });

  it('variableDeclaration matches const declarations', () => {
    const matches = querySource(simpleFunctions, 'typescript', typescriptProvider.patterns.variableDeclaration);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('importNamed matches named imports', () => {
    const matches = querySource(importsExports, 'typescript', typescriptProvider.patterns.importNamed);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('exportDefault matches default exports', () => {
    const matches = querySource(importsExports, 'typescript', typescriptProvider.patterns.exportDefault);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('consoleLog matches console.log calls', () => {
    const matches = querySource(simpleFunctions, 'typescript', typescriptProvider.patterns.consoleLog);
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it('interfaceDeclaration matches interfaces', () => {
    const matches = querySource(importsExports, 'typescript', typescriptProvider.patterns.interfaceDeclaration);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('typeAlias matches type aliases', () => {
    const matches = querySource(importsExports, 'typescript', typescriptProvider.patterns.typeAlias);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});

describe('tsxProvider - patterns match TSX fixtures', () => {
  const jsxComponent = readFileSync(join(fixturesDir, 'jsx-component.tsx'), 'utf-8');

  it('parses .tsx file correctly with Tsx parser', () => {
    const sgRoot = parseLangSource(jsxComponent, 'Tsx');
    const root = sgNodeToASTNode(sgRoot.root());
    expect(root.type).toBe('program');
  });

  it('finds functions in TSX file', () => {
    const matches = querySource(jsxComponent, 'tsx', tsxProvider.patterns.functionDeclaration);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('finds console.log in TSX file', () => {
    const matches = querySource(jsxComponent, 'tsx', tsxProvider.patterns.consoleLog);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('finds JSX self-closing elements', () => {
    const matches = querySource(jsxComponent, 'tsx', tsxProvider.patterns.jsxSelfClosing);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
