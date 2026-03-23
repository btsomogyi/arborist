import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const exec = promisify(execFile);
const CLI = resolve(import.meta.dirname, '../../../dist/cli/index.js');
const FIXTURE = resolve(import.meta.dirname, '../../fixtures/typescript/simple-functions.ts');

async function run(...args: string[]) {
  return exec('node', [CLI, ...args], { timeout: 10000, maxBuffer: 10 * 1024 * 1024 });
}

describe('CLI: parse', () => {
  it('parses a TypeScript file and shows AST', async () => {
    const { stdout } = await run('parse', FIXTURE);
    expect(stdout).toContain('File:');
    expect(stdout).toContain('Language: typescript');
    expect(stdout).toContain('function_declaration');
  });

  it('produces valid JSON with --json flag', async () => {
    const { stdout } = await run('--json', 'parse', FIXTURE);
    const parsed = JSON.parse(stdout);
    expect(parsed.file).toBe(FIXTURE);
    expect(parsed.language).toBe('typescript');
    expect(parsed.root).toBeDefined();
    expect(parsed.lineCount).toBeGreaterThan(0);
  });

  it('respects --depth option', async () => {
    const { stdout: shallow } = await run('--json', 'parse', FIXTURE, '--depth', '2');
    const { stdout: deep } = await run('--json', 'parse', FIXTURE, '--depth', '8');
    // Deeper parse should produce more output
    expect(deep.length).toBeGreaterThan(shallow.length);
  });

  it('exits with error for nonexistent file', async () => {
    try {
      await run('parse', 'nonexistent.ts');
      expect.fail('Should have thrown');
    } catch (err: unknown) {
      const e = err as { stderr: string; code: number };
      expect(e.stderr).toContain('Error:');
      expect(e.code).toBe(1);
    }
  });
});
