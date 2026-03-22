import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pythonProvider } from '../../../src/languages/python.js';
import { registry } from '../../../src/core/language-registry.js';
import { querySource } from '../../../src/engine/query.js';

const fixturesDir = join(import.meta.dirname, '../../fixtures/python');

beforeAll(() => {
  if (!registry.has('python')) registry.register(pythonProvider);
});

describe('pythonProvider - metadata', () => {
  it('has correct id', () => {
    expect(pythonProvider.id).toBe('python');
  });

  it('has correct displayName', () => {
    expect(pythonProvider.displayName).toBe('Python');
  });

  it('has correct extensions', () => {
    expect(pythonProvider.extensions).toContain('.py');
    expect(pythonProvider.extensions).toContain('.pyi');
  });

  it('has correct astGrepLang', () => {
    expect(pythonProvider.astGrepLang).toBe('Python');
  });

  it('has non-empty node type arrays', () => {
    for (const [key, types] of Object.entries(pythonProvider.nodeTypes)) {
      expect(types.length, `nodeTypes.${key} should not be empty`).toBeGreaterThan(0);
    }
  });
});

describe('pythonProvider - patterns match against fixtures', () => {
  const simpleFunctions = readFileSync(join(fixturesDir, 'simple-functions.py'), 'utf-8');
  const classes = readFileSync(join(fixturesDir, 'classes.py'), 'utf-8');
  const imports = readFileSync(join(fixturesDir, 'imports.py'), 'utf-8');
  const decorators = readFileSync(join(fixturesDir, 'decorators.py'), 'utf-8');

  it('functionDeclaration matches functions', () => {
    const matches = querySource(simpleFunctions, 'python', pythonProvider.patterns.functionDeclaration);
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });

  it('asyncFunction matches async def', () => {
    const matches = querySource(simpleFunctions, 'python', pythonProvider.patterns.asyncFunction);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('classDeclaration matches classes', () => {
    const matches = querySource(classes, 'python', pythonProvider.patterns.classDeclaration);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('classWithBase matches classes with inheritance', () => {
    const matches = querySource(classes, 'python', pythonProvider.patterns.classWithBase);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('importStatement matches simple imports', () => {
    const matches = querySource(imports, 'python', pythonProvider.patterns.importStatement);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('importFrom matches from...import statements', () => {
    const matches = querySource(imports, 'python', pythonProvider.patterns.importFrom);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('printCall matches print calls', () => {
    const matches = querySource(simpleFunctions, 'python', pythonProvider.patterns.printCall);
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('decorator matches simple decorators', () => {
    const matches = querySource(decorators, 'python', pythonProvider.patterns.decorator);
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it('decoratorWithArgs matches decorators with arguments', () => {
    const matches = querySource(decorators, 'python', pythonProvider.patterns.decoratorWithArgs);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('methodDefinition matches methods with self', () => {
    const matches = querySource(classes, 'python', pythonProvider.patterns.methodDefinition);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});

describe('pythonProvider - indentation-sensitive patterns', () => {
  const indentation = readFileSync(join(fixturesDir, 'indentation.py'), 'utf-8');

  it('finds functions in indentation fixture', () => {
    const matches = querySource(indentation, 'python', pythonProvider.patterns.functionDeclaration);
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('finds classes in indentation fixture', () => {
    const matches = querySource(indentation, 'python', pythonProvider.patterns.classDeclaration);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('finds nested method definitions', () => {
    const matches = querySource(indentation, 'python', pythonProvider.patterns.methodDefinition);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('finds print calls in nested contexts', () => {
    const matches = querySource(indentation, 'python', pythonProvider.patterns.printCall);
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
