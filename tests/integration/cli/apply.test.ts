import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const exec = promisify(execFile);
const CLI = resolve(import.meta.dirname, '../../../dist/cli/index.js');
const FIXTURE = resolve(import.meta.dirname, '../../fixtures/typescript/simple-functions.ts');

async function run(...args: string[]) {
  return exec('node', [CLI, ...args], { timeout: 10000 });
}

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(resolve(tmpdir(), 'scissorhands-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('CLI: apply', () => {
  it('applies batch edits from a JSON file', async () => {
    const srcFile = resolve(tmpDir, 'source.ts');
    const content = await readFile(FIXTURE, 'utf-8');
    await writeFile(srcFile, content);

    const editsFile = resolve(tmpDir, 'edits.json');
    await writeFile(editsFile, JSON.stringify({
      edits: [{
        file: srcFile,
        operation: {
          kind: 'replace',
          pattern: 'console.log($MSG)',
          replacement: 'logger.info($MSG)',
        },
      }],
    }));

    const { stdout } = await run('apply', editsFile);
    expect(stdout).toContain('Files modified: 1');

    const modified = await readFile(srcFile, 'utf-8');
    expect(modified).toContain('logger.info');
  });

  it('reports errors for invalid JSON', async () => {
    const editsFile = resolve(tmpDir, 'bad.json');
    await writeFile(editsFile, '{ invalid json }');

    try {
      await run('apply', editsFile);
      expect.fail('Should have thrown');
    } catch (err: unknown) {
      const e = err as { stderr: string; code: number };
      expect(e.stderr).toContain('Invalid JSON');
    }
  });

  it('--dry-run shows results without writing files', async () => {
    const srcFile = resolve(tmpDir, 'source.ts');
    const content = await readFile(FIXTURE, 'utf-8');
    await writeFile(srcFile, content);

    const editsFile = resolve(tmpDir, 'edits.json');
    await writeFile(editsFile, JSON.stringify({
      edits: [{
        file: srcFile,
        operation: {
          kind: 'replace',
          pattern: 'console.log($MSG)',
          replacement: 'logger.info($MSG)',
        },
      }],
    }));

    await run('apply', editsFile, '--dry-run');
    // File should not be modified
    const afterContent = await readFile(srcFile, 'utf-8');
    expect(afterContent).toBe(content);
  });
});
