import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
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

describe('Cross-Language Fixture Validation', () => {
  // ---------------------------------------------------------------------------
  // TypeScript New Fixtures
  // ---------------------------------------------------------------------------
  describe('TypeScript - Generics', () => {
    const source = readFileSync(join(tsFixturesDir, 'generics.ts'), 'utf-8');

    it('queries for generic functions', () => {
      const matches = querySource(
        source,
        'typescript',
        'function $NAME<$$$TPARAMS>($$$PARAMS): $RET { $$$BODY }',
      );
      const names = matches.map((m) => m.captures.NAME).filter(Boolean);
      expect(names).toContain('identity');
      expect(names).toContain('getProperty');
    });

    it('queries for generic classes', () => {
      const matches = querySource(
        source,
        'typescript',
        'class $NAME<$$$TPARAMS> { $$$BODY }',
      );
      const names = matches.map((m) => m.captures.NAME).filter(Boolean);
      expect(names).toContain('Collection');
    });

    it('queries for interfaces', () => {
      const matches = querySource(source, 'typescript', 'interface $NAME { $$$BODY }');
      const names = matches.map((m) => m.captures.NAME).filter(Boolean);
      expect(names.length).toBeGreaterThanOrEqual(1);
      expect(names).toContain('User');
    });

    it('replaces console.log with logger.info', () => {
      const result = applyEditToSource(source, 'typescript', {
        kind: 'replace',
        pattern: 'console.log($MSG)',
        replacement: 'logger.info($MSG)',
      });
      expect(result.newSource).not.toContain('console.log');
      expect(result.newSource).toContain('logger.info');
      expect(result.editCount).toBeGreaterThanOrEqual(2);
      expect(result.syntaxValid).toBe(true);
    });

    it('renames Collection to Container', () => {
      const result = applyEditToSource(source, 'typescript', {
        kind: 'rename',
        from: 'Collection',
        to: 'Container',
      });
      // rename replaces identifier references; the export should be updated
      expect(result.newSource).toContain('Container');
      expect(result.syntaxValid).toBe(true);
    });
  });

  describe('TypeScript - Async Patterns', () => {
    const source = readFileSync(join(tsFixturesDir, 'async-patterns.ts'), 'utf-8');

    it('queries for async functions with return types', () => {
      // async functions with return type annotations
      const typed = querySource(
        source,
        'typescript',
        'async function $NAME($$$PARAMS): $RET { $$$BODY }',
      );
      const names = typed.map((m) => m.captures.NAME).filter(Boolean);
      expect(names).toContain('processAll');
    });

    it('queries for async functions with generics', () => {
      const generic = querySource(
        source,
        'typescript',
        'async function $NAME<$$$TPARAMS>($$$PARAMS): $RET { $$$BODY }',
      );
      const names = generic.map((m) => m.captures.NAME).filter(Boolean);
      expect(names).toContain('fetchJSON');
    });

    it('queries for console.log calls', () => {
      const matches = querySource(source, 'typescript', 'console.log($MSG)');
      expect(matches.length).toBeGreaterThanOrEqual(4);
    });

    it('replaces console.log with logger.info', () => {
      const result = applyEditToSource(source, 'typescript', {
        kind: 'replace',
        pattern: 'console.log($MSG)',
        replacement: 'logger.info($MSG)',
      });
      expect(result.newSource).not.toContain('console.log');
      expect(result.newSource).toContain('logger.info("Fetching: " + url)');
      expect(result.syntaxValid).toBe(true);
    });

    it('removes console.log statements', () => {
      const result = applyEditToSource(source, 'typescript', {
        kind: 'remove',
        pattern: 'console.log($MSG)',
      });
      expect(result.newSource).not.toContain('console.log');
      expect(result.newSource).toContain('async function');
      expect(result.newSource).toContain('await fetch(url)');
      expect(result.syntaxValid).toBe(true);
    });

    it('inserts a comment before the processAll function', () => {
      const result = applyEditToSource(source, 'typescript', {
        kind: 'insert',
        anchor: 'async function processAll($$$PARAMS): $RET { $$$BODY }',
        position: 'before',
        content: '/** Processes all URLs concurrently. */',
      });
      expect(result.newSource).toContain('/** Processes all URLs concurrently. */');
      const commentIdx = result.newSource.indexOf('/** Processes all URLs');
      const fnIdx = result.newSource.indexOf('async function processAll');
      expect(commentIdx).toBeLessThan(fnIdx);
      expect(result.syntaxValid).toBe(true);
    });
  });

  describe('TypeScript - Enums and Type Guards', () => {
    const source = readFileSync(join(tsFixturesDir, 'enums-decorators.ts'), 'utf-8');

    it('queries for enum declarations', () => {
      const matches = querySource(source, 'typescript', 'enum $NAME { $$$BODY }');
      const names = matches.map((m) => m.captures.NAME).filter(Boolean);
      expect(names).toContain('Status');
      expect(names).toContain('Priority');
    });

    it('queries for console.log calls', () => {
      const matches = querySource(source, 'typescript', 'console.log($MSG)');
      expect(matches.length).toBeGreaterThanOrEqual(3);
    });

    it('replaces console.log with logger.info', () => {
      const result = applyEditToSource(source, 'typescript', {
        kind: 'replace',
        pattern: 'console.log($MSG)',
        replacement: 'logger.info($MSG)',
      });
      expect(result.newSource).not.toContain('console.log');
      expect(result.newSource).toContain('logger.info');
      expect(result.syntaxValid).toBe(true);
    });

    it('renames Service to AppService in references', () => {
      const result = applyEditToSource(source, 'typescript', {
        kind: 'rename',
        from: 'Service',
        to: 'AppService',
      });
      // rename updates identifier references; verify at least some were changed
      expect(result.newSource).toContain('AppService');
      expect(result.editCount).toBeGreaterThanOrEqual(1);
      expect(result.syntaxValid).toBe(true);
    });

    it('queries for class declarations', () => {
      const matches = querySource(source, 'typescript', 'class $NAME { $$$BODY }');
      const names = matches.map((m) => m.captures.NAME).filter(Boolean);
      expect(names).toContain('Service');
    });
  });

  // ---------------------------------------------------------------------------
  // Python New Fixtures
  // ---------------------------------------------------------------------------
  describe('Python - Async Patterns', () => {
    const source = readFileSync(join(pyFixturesDir, 'async-patterns.py'), 'utf-8');

    it('queries for async def functions', () => {
      const matches = querySource(source, 'python', 'async def $NAME($$$PARAMS)');
      const names = matches.map((m) => m.captures.NAME).filter(Boolean);
      expect(names).toContain('fetch_data');
      expect(names).toContain('process_batch');
      expect(names).toContain('gather_results');
    });

    it('queries for print calls', () => {
      const matches = querySource(source, 'python', 'print($MSG)');
      expect(matches.length).toBeGreaterThanOrEqual(4);
    });

    it('replaces print with logging.info', () => {
      const result = applyEditToSource(source, 'python', {
        kind: 'replace',
        pattern: 'print($MSG)',
        replacement: 'logging.info($MSG)',
      });
      expect(result.newSource).toContain('logging.info');
      expect(result.editCount).toBeGreaterThanOrEqual(4);
      expect(result.syntaxValid).toBe(true);
    });

    it('renames fetch_data to download_data', () => {
      const result = applyEditToSource(source, 'python', {
        kind: 'rename',
        from: 'fetch_data',
        to: 'download_data',
      });
      expect(result.newSource).toContain('async def download_data');
      expect(result.newSource).not.toMatch(/\bfetch_data\b/);
      expect(result.syntaxValid).toBe(true);
    });

    it('queries for class definitions', () => {
      const matches = querySource(source, 'python', 'class $NAME');
      const names = matches.map((m) => m.captures.NAME).filter(Boolean);
      expect(names).toContain('AsyncService');
    });
  });

  describe('Python - Type Hints', () => {
    const source = readFileSync(join(pyFixturesDir, 'type-hints.py'), 'utf-8');

    it('queries for class definitions', () => {
      const matches = querySource(source, 'python', 'class $NAME');
      const names = matches.map((m) => m.captures.NAME).filter(Boolean);
      expect(names).toContain('Comparable');
      expect(names).toContain('Stack');
    });

    it('queries for function definitions', () => {
      const matches = querySource(source, 'python', 'def $NAME($$$PARAMS)');
      const names = matches.map((m) => m.captures.NAME).filter(Boolean);
      expect(names).toContain('find_max');
      expect(names).toContain('parse_value');
      expect(names).toContain('process_items');
    });

    it('replaces print with logging.info', () => {
      const result = applyEditToSource(source, 'python', {
        kind: 'replace',
        pattern: 'print($MSG)',
        replacement: 'logging.info($MSG)',
      });
      expect(result.newSource).toContain('logging.info');
      expect(result.newSource).not.toContain('print(');
      expect(result.editCount).toBeGreaterThanOrEqual(3);
      expect(result.syntaxValid).toBe(true);
    });

    it('renames Stack to ArrayStack', () => {
      const result = applyEditToSource(source, 'python', {
        kind: 'rename',
        from: 'Stack',
        to: 'ArrayStack',
      });
      expect(result.newSource).toContain('class ArrayStack');
      expect(result.newSource).not.toMatch(/\bStack\b/);
      expect(result.syntaxValid).toBe(true);
    });

    it('removes print statements', () => {
      const result = applyEditToSource(source, 'python', {
        kind: 'remove',
        pattern: 'print($MSG)',
      });
      expect(result.newSource).not.toContain('print(');
      expect(result.newSource).toContain('class Stack');
      expect(result.newSource).toContain('def find_max');
      expect(result.syntaxValid).toBe(true);
    });
  });

  describe('Python - Dataclasses and Context Managers', () => {
    const source = readFileSync(join(pyFixturesDir, 'dataclasses-context.py'), 'utf-8');

    it('queries for class definitions', () => {
      const matches = querySource(source, 'python', 'class $NAME');
      const names = matches.map((m) => m.captures.NAME).filter(Boolean);
      expect(names).toContain('Point');
      expect(names).toContain('Config');
      expect(names).toContain('ResourcePool');
    });

    it('queries for function definitions', () => {
      const matches = querySource(source, 'python', 'def $NAME($$$PARAMS)');
      const names = matches.map((m) => m.captures.NAME).filter(Boolean);
      expect(names).toContain('managed_resource');
      expect(names).toContain('timer');
      expect(names).toContain('distance_to');
    });

    it('queries for print calls', () => {
      const matches = querySource(source, 'python', 'print($MSG)');
      expect(matches.length).toBeGreaterThanOrEqual(5);
    });

    it('replaces print with logging.info', () => {
      const result = applyEditToSource(source, 'python', {
        kind: 'replace',
        pattern: 'print($MSG)',
        replacement: 'logging.info($MSG)',
      });
      expect(result.newSource).toContain('logging.info');
      expect(result.editCount).toBeGreaterThanOrEqual(5);
      expect(result.syntaxValid).toBe(true);
    });

    it('preserves decorator syntax after edits', () => {
      const result = applyEditToSource(source, 'python', {
        kind: 'replace',
        pattern: 'print($MSG)',
        replacement: 'logging.info($MSG)',
      });
      expect(result.newSource).toContain('@dataclass');
      expect(result.newSource).toContain('@contextmanager');
      expect(result.newSource).toContain('from dataclasses import dataclass, field');
    });
  });

  // ---------------------------------------------------------------------------
  // Go Fixtures (existence and content validation only - no provider yet)
  // ---------------------------------------------------------------------------
  describe('Go Fixtures - Existence Validation', () => {
    const goDir = join(import.meta.dirname, '../fixtures/golang');

    const goFiles = [
      'simple-functions.go',
      'structs-interfaces.go',
      'imports.go',
      'concurrency.go',
      'error-handling.go',
    ];

    for (const file of goFiles) {
      it(`fixture exists: ${file}`, () => {
        expect(existsSync(join(goDir, file))).toBe(true);
      });
    }

    it('simple-functions.go contains expected constructs', () => {
      const source = readFileSync(join(goDir, 'simple-functions.go'), 'utf-8');
      expect(source).toContain('func greet');
      expect(source).toContain('func divide');
      expect(source).toContain('func sum');
      expect(source).toContain('func FormatDate');
      expect(source).toContain('fmt.Println');
    });

    it('structs-interfaces.go contains expected constructs', () => {
      const source = readFileSync(join(goDir, 'structs-interfaces.go'), 'utf-8');
      expect(source).toContain('type Speaker interface');
      expect(source).toContain('type Animal struct');
      expect(source).toContain('type Dog struct');
      expect(source).toContain('func (a *Animal) Speak()');
      expect(source).toContain('func NewDog');
    });

    it('imports.go contains standard library imports', () => {
      const source = readFileSync(join(goDir, 'imports.go'), 'utf-8');
      expect(source).toContain('encoding/json');
      expect(source).toContain('net/http');
      expect(source).toContain('fmt');
      expect(source).toContain('sync');
    });

    it('concurrency.go contains goroutine patterns', () => {
      const source = readFileSync(join(goDir, 'concurrency.go'), 'utf-8');
      expect(source).toContain('chan<-');
      expect(source).toContain('<-chan');
      expect(source).toContain('sync.WaitGroup');
      expect(source).toContain('sync.Mutex');
      expect(source).toContain('go func');
    });

    it('error-handling.go contains error patterns', () => {
      const source = readFileSync(join(goDir, 'error-handling.go'), 'utf-8');
      expect(source).toContain('errors.New');
      expect(source).toContain('fmt.Errorf');
      expect(source).toContain('errors.Is');
      expect(source).toContain('recover()');
    });
  });

  // ---------------------------------------------------------------------------
  // Rust Fixtures (existence and content validation only - no provider yet)
  // ---------------------------------------------------------------------------
  describe('Rust Fixtures - Existence Validation', () => {
    const rustDir = join(import.meta.dirname, '../fixtures/rust');

    const rustFiles = [
      'simple-functions.rs',
      'structs-traits.rs',
      'enums-matching.rs',
      'ownership-lifetimes.rs',
      'error-handling.rs',
    ];

    for (const file of rustFiles) {
      it(`fixture exists: ${file}`, () => {
        expect(existsSync(join(rustDir, file))).toBe(true);
      });
    }

    it('simple-functions.rs contains expected constructs', () => {
      const source = readFileSync(join(rustDir, 'simple-functions.rs'), 'utf-8');
      expect(source).toContain('fn greet');
      expect(source).toContain('fn divide');
      expect(source).toContain('fn largest<T');
      expect(source).toContain('async fn fetch_data');
      expect(source).toContain('pub fn format_date');
      expect(source).toContain('println!');
    });

    it('structs-traits.rs contains expected constructs', () => {
      const source = readFileSync(join(rustDir, 'structs-traits.rs'), 'utf-8');
      expect(source).toContain('trait Speaker');
      expect(source).toContain('struct Animal');
      expect(source).toContain('struct Dog');
      expect(source).toContain('impl Speaker for Animal');
      expect(source).toContain('impl Speaker for Dog');
      expect(source).toContain('#[derive(Debug');
    });

    it('enums-matching.rs contains enum and match patterns', () => {
      const source = readFileSync(join(rustDir, 'enums-matching.rs'), 'utf-8');
      expect(source).toContain('enum Color');
      expect(source).toContain('enum Shape');
      expect(source).toContain('match self');
      expect(source).toContain('Option<usize>');
      expect(source).toContain('Result<String, String>');
    });

    it('ownership-lifetimes.rs contains ownership and lifetime patterns', () => {
      const source = readFileSync(join(rustDir, 'ownership-lifetimes.rs'), 'utf-8');
      expect(source).toContain("fn longest<'a>");
      expect(source).toContain("struct Excerpt<'a>");
      expect(source).toContain('&mut String');
      expect(source).toContain('impl Fn(i32) -> i32');
      expect(source).toContain('move |y|');
    });

    it('error-handling.rs contains error patterns', () => {
      const source = readFileSync(join(rustDir, 'error-handling.rs'), 'utf-8');
      expect(source).toContain('enum AppError');
      expect(source).toContain('impl fmt::Display for AppError');
      expect(source).toContain('impl From<ParseIntError>');
      expect(source).toContain('s.parse()?');
    });
  });
});
