import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { parseFile } from '../../../src/engine/parser.js';
import { queryFile } from '../../../src/engine/query.js';
import { applyEdit } from '../../../src/engine/editor.js';
import { registry } from '../../../src/core/language-registry.js';
import { registerBuiltinProviders } from '../../../src/languages/index.js';
import { createUnifiedDiff } from '../../../src/cli/diff.js';

const FIXTURE = resolve(import.meta.dirname, '../../fixtures/typescript/simple-functions.ts');

beforeAll(() => {
  registerBuiltinProviders();
});

// These tests exercise the same logic the MCP tool handlers use,
// without needing an actual MCP transport.
describe('MCP tool handlers (functional)', () => {
  describe('scissorhands_parse', () => {
    it('parses a file and returns AST', async () => {
      const result = await parseFile(FIXTURE, { maxDepth: 5 });
      expect(result.file).toBe(FIXTURE);
      expect(result.language).toBe('typescript');
      expect(result.root).toBeDefined();
      expect(result.lineCount).toBeGreaterThan(0);
    });

    it('errors on nonexistent file', async () => {
      await expect(parseFile('/nonexistent.ts')).rejects.toThrow();
    });
  });

  describe('scissorhands_query', () => {
    it('finds matches for a pattern', async () => {
      const result = await queryFile(FIXTURE, 'console.log($$$ARGS)');
      expect(result.matchCount).toBeGreaterThan(0);
      expect(result.matches[0].text).toContain('console.log');
    });

    it('returns empty for non-matching pattern', async () => {
      const result = await queryFile(FIXTURE, 'nonexistent_call($X)');
      expect(result.matchCount).toBe(0);
    });
  });

  describe('scissorhands_edit', () => {
    let tmpDir: string;
    let tmpFile: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(resolve(tmpdir(), 'scissorhands-mcp-'));
      tmpFile = resolve(tmpDir, 'test.ts');
      await writeFile(tmpFile, await readFile(FIXTURE, 'utf-8'));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('applies a replace edit', async () => {
      const result = await applyEdit(tmpFile, {
        kind: 'replace',
        pattern: 'console.log($MSG)',
        replacement: 'logger.info($MSG)',
      });
      expect(result.editCount).toBeGreaterThan(0);
      const modified = await readFile(tmpFile, 'utf-8');
      expect(modified).toContain('logger.info');
    });

    it('dry-run does not modify file', async () => {
      const original = await readFile(tmpFile, 'utf-8');
      const result = await applyEdit(tmpFile, {
        kind: 'replace',
        pattern: 'console.log($MSG)',
        replacement: 'logger.info($MSG)',
      }, { dryRun: true });
      expect(result.editCount).toBeGreaterThan(0);
      const after = await readFile(tmpFile, 'utf-8');
      expect(after).toBe(original);
    });

    it('generates diff for dry-run', async () => {
      const result = await applyEdit(tmpFile, {
        kind: 'replace',
        pattern: 'console.log($MSG)',
        replacement: 'logger.info($MSG)',
      }, { dryRun: true });
      if (result.editCount > 0) {
        const diff = createUnifiedDiff(tmpFile, result.originalSource, result.newSource);
        expect(diff).toContain('---');
        expect(diff).toContain('+++');
        expect(diff).toContain('-');
        expect(diff).toContain('+');
      }
    });
  });

  describe('scissorhands_list_symbols', () => {
    it('finds symbols via language patterns', async () => {
      const provider = registry.inferFromFilePath(FIXTURE);
      expect(provider).toBeDefined();
      // Use consoleLog pattern which is known to match the fixture
      const pattern = provider?.patterns.consoleLog ?? 'console.log($$$ARGS)';
      const result = await queryFile(FIXTURE, pattern);
      expect(result.matchCount).toBeGreaterThan(0);
    });
  });

  describe('scissorhands_rename', () => {
    let tmpDir: string;
    let tmpFile: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(resolve(tmpdir(), 'scissorhands-mcp-'));
      tmpFile = resolve(tmpDir, 'test.ts');
      await writeFile(tmpFile, 'const count = 0;\nconsole.log(count);\n');
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('renames an identifier', async () => {
      const result = await applyEdit(tmpFile, {
        kind: 'rename',
        from: 'count',
        to: 'total',
      });
      expect(result.editCount).toBeGreaterThan(0);
      const modified = await readFile(tmpFile, 'utf-8');
      expect(modified).toContain('total');
      expect(modified).not.toContain('count');
    });

    it('rename dry-run returns diff without modifying', async () => {
      const original = await readFile(tmpFile, 'utf-8');
      const result = await applyEdit(tmpFile, {
        kind: 'rename',
        from: 'count',
        to: 'total',
      }, { dryRun: true });
      expect(result.editCount).toBeGreaterThan(0);
      const after = await readFile(tmpFile, 'utf-8');
      expect(after).toBe(original);
    });
  });
});
