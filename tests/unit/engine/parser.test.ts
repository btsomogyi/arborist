import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { parseFile, parseString, sgNodeToASTNode, parseLangSource, clearParseCache } from '../../../src/engine/parser.js';
import { ProviderError, FileError } from '../../../src/core/errors.js';
import { registerTestProviders } from '../../helpers/register-providers.js';

const tmpDir = join(import.meta.dirname, '../../.tmp-parser');

beforeAll(async () => {
  registerTestProviders();

  await mkdir(tmpDir, { recursive: true });
  await writeFile(join(tmpDir, 'sample.ts'), 'const x: number = 42;\nfunction greet(name: string) {\n  return `Hello, ${name}!`;\n}\n');
  await writeFile(join(tmpDir, 'sample.py'), 'def greet(name):\n    return f"Hello, {name}!"\n\nx = 42\n');
  clearParseCache();

  return async () => {
    await rm(tmpDir, { recursive: true, force: true });
  };
});

describe('parseString', () => {
  it('parses TypeScript and returns program root', () => {
    const result = parseString('const x = 1;', 'typescript');
    expect(result.root.type).toBe('program');
    expect(result.language).toBe('typescript');
    expect(result.file).toBe('<string>');
    expect(result.sourceLength).toBe(12);
    expect(result.lineCount).toBe(1);
  });

  it('parses Python and returns module root', () => {
    const result = parseString('x = 1\n', 'python');
    expect(result.root.type).toBe('module');
    expect(result.language).toBe('python');
  });

  it('includes children in AST', () => {
    const result = parseString('const x = 1;', 'typescript');
    expect(result.root.namedChildren.length).toBeGreaterThan(0);
  });

  it('throws ProviderError for unknown language', () => {
    expect(() => parseString('code', 'unknown-lang')).toThrow(ProviderError);
  });
});

describe('parseFile', () => {
  it('parses a TypeScript file from disk', async () => {
    const result = await parseFile(join(tmpDir, 'sample.ts'));
    expect(result.root.type).toBe('program');
    expect(result.language).toBe('typescript');
    expect(result.lineCount).toBeGreaterThan(1);
  });

  it('parses a Python file from disk', async () => {
    const result = await parseFile(join(tmpDir, 'sample.py'));
    expect(result.root.type).toBe('module');
    expect(result.language).toBe('python');
  });

  it('throws FileError for non-existent file', async () => {
    await expect(parseFile(join(tmpDir, 'nonexistent.ts'))).rejects.toThrow(FileError);
  });

  it('throws ProviderError for unsupported extension', async () => {
    await writeFile(join(tmpDir, 'data.xyz'), 'content');
    await expect(parseFile(join(tmpDir, 'data.xyz'))).rejects.toThrow(ProviderError);
  });

  it('respects language override', async () => {
    const result = await parseFile(join(tmpDir, 'sample.ts'), { language: 'typescript' });
    expect(result.language).toBe('typescript');
  });
});

describe('sgNodeToASTNode', () => {
  it('respects maxDepth truncation', () => {
    const sgRoot = parseLangSource('function foo() { if (true) { const x = 1; } }', 'TypeScript');
    const deep = sgNodeToASTNode(sgRoot.root(), 10);
    const shallow = sgNodeToASTNode(sgRoot.root(), 1);
    // Shallow: root (depth 0) has children, but children (depth 1) have no children
    expect(shallow.children.length).toBeGreaterThan(0);
    expect(shallow.children[0].children).toEqual([]);
    // Deep tree should have nesting beyond depth 1
    expect(deep.children[0].children.length).toBeGreaterThan(0);
  });

  it('populates range and byteRange', () => {
    const sgRoot = parseLangSource('const x = 1;', 'TypeScript');
    const node = sgNodeToASTNode(sgRoot.root());
    expect(node.range.start.line).toBe(0);
    expect(node.range.start.column).toBe(0);
    expect(node.byteRange.startByte).toBe(0);
    expect(node.byteRange.endByte).toBe(12);
  });
});
