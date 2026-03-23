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
let tmpFile: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(resolve(tmpdir(), 'arborist-test-'));
  tmpFile = resolve(tmpDir, 'test.ts');
  const content = await readFile(FIXTURE, 'utf-8');
  await writeFile(tmpFile, content);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('CLI: edit', () => {
  it('--dry-run shows diff without modifying file', async () => {
    const originalContent = await readFile(tmpFile, 'utf-8');
    const { stdout } = await run('edit', tmpFile, '--replace', '--pattern', 'console.log($MSG)', '--with', 'logger.info($MSG)', '--dry-run');

    expect(stdout).toContain('Edits:');
    // File should not be modified
    const afterContent = await readFile(tmpFile, 'utf-8');
    expect(afterContent).toBe(originalContent);
  });

  it('--replace modifies the file', async () => {
    await run('edit', tmpFile, '--replace', '--pattern', 'console.log($MSG)', '--with', 'logger.info($MSG)');
    const modified = await readFile(tmpFile, 'utf-8');
    expect(modified).toContain('logger.info');
    expect(modified).not.toContain('console.log');
  });

  it('--rename renames identifiers', async () => {
    // Create a simple file with a renamable variable
    await writeFile(tmpFile, 'const count = 0;\nconsole.log(count);\n');
    await run('edit', tmpFile, '--rename', '--from', 'count', '--to', 'total');
    const modified = await readFile(tmpFile, 'utf-8');
    expect(modified).toContain('total');
  });

  it('--dry-run with --json produces valid JSON with diff', async () => {
    const { stdout } = await run('--json', 'edit', tmpFile, '--replace', '--pattern', 'console.log($MSG)', '--with', 'logger.info($MSG)', '--dry-run');
    const parsed = JSON.parse(stdout);
    expect(parsed.editCount).toBeGreaterThan(0);
    expect(parsed.diff).toBeDefined();
    expect(parsed.diff).toContain('---');
  });
});
