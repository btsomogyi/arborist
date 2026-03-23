import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const exec = promisify(execFile);
const CLI = resolve(import.meta.dirname, '../../../dist/cli/index.js');
const FIXTURE = resolve(import.meta.dirname, '../../fixtures/typescript/simple-functions.ts');

async function run(...args: string[]) {
  return exec('node', [CLI, ...args], { timeout: 10000 });
}

describe('CLI: query', () => {
  it('finds functions matching a pattern', async () => {
    const { stdout } = await run('query', FIXTURE, '--pattern', 'console.log($$$ARGS)');
    expect(stdout).toContain('Matches:');
    expect(stdout).toContain('call_expression');
  });

  it('produces parseable JSON output', async () => {
    const { stdout } = await run('--json', 'query', FIXTURE, '--pattern', 'console.log($$$ARGS)');
    const parsed = JSON.parse(stdout);
    expect(parsed.matchCount).toBeGreaterThan(0);
    expect(parsed.matches).toBeInstanceOf(Array);
    expect(parsed.matches[0].text).toContain('console.log');
  });

  it('returns empty results for non-matching pattern', async () => {
    const { stdout } = await run('--json', 'query', FIXTURE, '--pattern', 'nonexistent_function($X)');
    const parsed = JSON.parse(stdout);
    expect(parsed.matchCount).toBe(0);
    expect(parsed.matches).toEqual([]);
  });

  it('exits with error when --pattern is missing', async () => {
    try {
      await run('query', FIXTURE);
      expect.fail('Should have thrown');
    } catch (err: unknown) {
      const e = err as { stderr: string; code: number };
      expect(e.stderr).toContain('pattern');
    }
  });
});
