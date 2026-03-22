import { describe, it, expect, beforeAll } from 'vitest';
import { querySource } from '../../src/engine/query.js';
import { applyEditToSource } from '../../src/engine/editor.js';
import { registerTestProviders } from '../helpers/register-providers.js';

beforeAll(() => {
  registerTestProviders();
});

describe('Engine Pipeline Integration: parse -> query -> edit -> verify', () => {
  const tsFixture = [
    '// Authentication module',
    'const API_KEY = "secret-123";',
    '',
    'function authenticate(user, pass) {',
    '  console.log("Authenticating: " + user);',
    '  if (user === "admin") {',
    '    console.log("Admin access granted");',
    '    return true;',
    '  }',
    '  console.log("Access denied for: " + user);',
    '  return false;',
    '}',
    '',
    'function logout(user) {',
    '  console.log("Logging out: " + user);',
    '}',
    '',
    'export { authenticate, logout };',
    '',
  ].join('\n');

  it('replaces all console.log with logger.info and preserves formatting', () => {
    const matches = querySource(tsFixture, 'typescript', 'console.log($MSG)');
    expect(matches.length).toBe(4);

    const result = applyEditToSource(tsFixture, 'typescript', {
      kind: 'replace',
      pattern: 'console.log($MSG)',
      replacement: 'logger.info($MSG)',
    });

    expect(result.editCount).toBe(4);
    expect(result.newSource).not.toContain('console.log');
    expect(result.newSource).toContain('logger.info("Authenticating: " + user)');
    expect(result.newSource).toContain('logger.info("Admin access granted")');
    expect(result.newSource).toContain('logger.info("Access denied for: " + user)');
    expect(result.newSource).toContain('logger.info("Logging out: " + user)');

    expect(result.newSource).toContain('// Authentication module');
    expect(result.newSource).toContain('const API_KEY = "secret-123"');
    expect(result.newSource).toContain('export { authenticate, logout }');
    expect(result.syntaxValid).toBe(true);

    const afterMatches = querySource(result.newSource, 'typescript', 'logger.info($MSG)');
    expect(afterMatches.length).toBe(4);

    const staleMatches = querySource(result.newSource, 'typescript', 'console.log($MSG)');
    expect(staleMatches.length).toBe(0);
  });

  it('renames a function and all references', () => {
    const result = applyEditToSource(tsFixture, 'typescript', {
      kind: 'rename',
      from: 'authenticate',
      to: 'verifyCredentials',
    });

    expect(result.newSource).toContain('function verifyCredentials');
    expect(result.newSource).toContain('export { verifyCredentials, logout }');
    expect(result.newSource).not.toContain('authenticate');
    expect(result.syntaxValid).toBe(true);
  });

  it('removes console.log statements with line cleanup', () => {
    const result = applyEditToSource(tsFixture, 'typescript', {
      kind: 'remove',
      pattern: 'console.log($MSG)',
    });

    expect(result.newSource).not.toContain('console.log');
    expect(result.syntaxValid).toBe(true);
    expect(result.newSource).toContain('function authenticate');
    expect(result.newSource).toContain('return true');
  });

  it('inserts a comment before a function', () => {
    const result = applyEditToSource(tsFixture, 'typescript', {
      kind: 'insert',
      anchor: 'function logout($$$PARAMS) { $$$BODY }',
      position: 'before',
      content: '/** Logs the user out of the system. */',
    });

    expect(result.newSource).toContain('/** Logs the user out of the system. */');
    const commentIdx = result.newSource.indexOf('/** Logs the user out');
    const fnIdx = result.newSource.indexOf('function logout');
    expect(commentIdx).toBeLessThan(fnIdx);
    expect(result.syntaxValid).toBe(true);
  });
});

describe('Engine Pipeline Integration: Python', () => {
  const pyFixture = [
    '# Utility functions',
    'import os',
    '',
    'def process_data(items):',
    '    print("Processing...")',
    '    result = []',
    '    for item in items:',
    '        print("Item: " + str(item))',
    '        result.append(item * 2)',
    '    return result',
    '',
    'def summarize(data):',
    '    print("Summary: " + str(len(data)))',
    '    return len(data)',
    '',
  ].join('\n');

  it('replaces print with logging.info in Python', () => {
    const matches = querySource(pyFixture, 'python', 'print($MSG)');
    expect(matches.length).toBe(3);

    const result = applyEditToSource(pyFixture, 'python', {
      kind: 'replace',
      pattern: 'print($MSG)',
      replacement: 'logging.info($MSG)',
    });

    expect(result.editCount).toBe(3);
    expect(result.newSource).not.toContain('print(');
    expect(result.newSource).toContain('logging.info("Processing...")');
    expect(result.newSource).toContain('# Utility functions');
    expect(result.newSource).toContain('import os');
  });
});

describe('Formatting preservation - byte-level verification', () => {
  it('preserves bytes outside edit ranges exactly', () => {
    const source = 'const   x   =   1;\nconsole.log("target");\nconst   y   =   2;\n';
    const result = applyEditToSource(source, 'typescript', {
      kind: 'replace',
      pattern: 'console.log($MSG)',
      replacement: 'logger.info($MSG)',
    });

    const originalLines = source.split('\n');
    const newLines = result.newSource.split('\n');
    expect(newLines[0]).toBe(originalLines[0]);
    expect(newLines[2]).toBe(originalLines[2]);
  });
});
