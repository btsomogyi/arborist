import { describe, it, expect, beforeAll } from 'vitest';
import { applyEditToSource } from '../../../src/engine/editor.js';
import { EditError } from '../../../src/core/errors.js';
import { registerTestProviders } from '../../helpers/register-providers.js';

beforeAll(() => {
  registerTestProviders();
});

describe('editor - replace', () => {
  it('replaces console.log with logger.info using capture', () => {
    const source = 'console.log("hello");\nconsole.log("world");\n';
    const result = applyEditToSource(source, 'typescript', {
      kind: 'replace',
      pattern: 'console.log($MSG)',
      replacement: 'logger.info($MSG)',
    });
    expect(result.newSource).toBe('logger.info("hello");\nlogger.info("world");\n');
    expect(result.editCount).toBe(2);
    expect(result.syntaxValid).toBe(true);
  });

  it('replaces only the Nth match with matchIndex', () => {
    const source = 'console.log("a");\nconsole.log("b");\nconsole.log("c");\n';
    const result = applyEditToSource(source, 'typescript', {
      kind: 'replace',
      pattern: 'console.log($MSG)',
      replacement: 'logger.info($MSG)',
      matchIndex: 1,
    });
    expect(result.newSource).toBe('console.log("a");\nlogger.info("b");\nconsole.log("c");\n');
    expect(result.editCount).toBe(1);
  });

  it('replaces within scope only', () => {
    const source = 'function foo() {\n  console.log("inside");\n}\nconsole.log("outside");\n';
    const result = applyEditToSource(source, 'typescript', {
      kind: 'replace',
      pattern: 'console.log($MSG)',
      replacement: 'logger.info($MSG)',
      scope: 'function foo() { $$$BODY }',
    });
    expect(result.newSource).toContain('logger.info("inside")');
    expect(result.newSource).toContain('console.log("outside")');
    expect(result.editCount).toBe(1);
  });

  it('returns zero edits for non-matching pattern', () => {
    const source = 'const x = 1;\n';
    const result = applyEditToSource(source, 'typescript', {
      kind: 'replace',
      pattern: 'console.log($MSG)',
      replacement: 'logger.info($MSG)',
    });
    expect(result.editCount).toBe(0);
    expect(result.newSource).toBe(source);
  });

  it('throws EditError for invalid scope pattern', () => {
    expect(() =>
      applyEditToSource('const x = 1;', 'typescript', {
        kind: 'replace',
        pattern: 'console.log($MSG)',
        replacement: 'x',
        scope: 'function nonexistent() { $$$BODY }',
      }),
    ).toThrow(EditError);
  });
});

describe('editor - rename', () => {
  it('renames all occurrences of an identifier', () => {
    const source = 'const count = 0;\nfunction inc() {\n  return count + 1;\n}\nconsole.log(count);\n';
    const result = applyEditToSource(source, 'typescript', {
      kind: 'rename',
      from: 'count',
      to: 'total',
    });
    expect(result.newSource).not.toContain('count');
    expect(result.newSource).toContain('total');
    expect(result.editCount).toBe(3);
  });

  it('does not rename substrings of longer identifiers', () => {
    const source = 'const count = 0;\nconst countDown = 10;\nconst recount = 5;\n';
    const result = applyEditToSource(source, 'typescript', {
      kind: 'rename',
      from: 'count',
      to: 'total',
    });
    expect(result.newSource).toContain('total');
    expect(result.newSource).toContain('countDown');
    expect(result.newSource).toContain('recount');
  });

  it('returns zero edits when identifier not found', () => {
    const result = applyEditToSource('const x = 1;', 'typescript', {
      kind: 'rename',
      from: 'notHere',
      to: 'newName',
    });
    expect(result.editCount).toBe(0);
  });
});

describe('editor - insert', () => {
  it('inserts content before a matched node', () => {
    const source = 'function greet() {\n  return "hi";\n}\n';
    const result = applyEditToSource(source, 'typescript', {
      kind: 'insert',
      anchor: 'function greet() { $$$BODY }',
      position: 'before',
      content: '// Greets the user',
    });
    expect(result.newSource).toContain('// Greets the user');
    expect(result.newSource.indexOf('// Greets the user')).toBeLessThan(
      result.newSource.indexOf('function greet'),
    );
    expect(result.editCount).toBe(1);
  });

  it('inserts content after a matched node', () => {
    const source = 'function greet() {\n  return "hi";\n}\n';
    const result = applyEditToSource(source, 'typescript', {
      kind: 'insert',
      anchor: 'function greet() { $$$BODY }',
      position: 'after',
      content: 'function farewell() {\n  return "bye";\n}',
    });
    expect(result.newSource).toContain('farewell');
    expect(result.newSource.indexOf('farewell')).toBeGreaterThan(
      result.newSource.indexOf('greet'),
    );
  });

  it('throws EditError for non-matching anchor', () => {
    expect(() =>
      applyEditToSource('const x = 1;', 'typescript', {
        kind: 'insert',
        anchor: 'function nonexistent() { $$$BODY }',
        position: 'before',
        content: '// comment',
      }),
    ).toThrow(EditError);
  });
});

describe('editor - remove', () => {
  it('removes a matched statement', () => {
    const source = 'console.log("debug");\nconst x = 1;\n';
    const result = applyEditToSource(source, 'typescript', {
      kind: 'remove',
      pattern: 'console.log($$$ARGS)',
    });
    expect(result.newSource).not.toContain('console.log');
    expect(result.newSource).toContain('const x = 1');
    expect(result.editCount).toBe(1);
  });

  it('removes only the Nth match with matchIndex', () => {
    const source = 'console.log("a");\nconsole.log("b");\nconst x = 1;\n';
    const result = applyEditToSource(source, 'typescript', {
      kind: 'remove',
      pattern: 'console.log($$$ARGS)',
      matchIndex: 0,
    });
    expect(result.newSource).not.toContain('"a"');
    expect(result.newSource).toContain('console.log("b")');
    expect(result.editCount).toBe(1);
  });

  it('returns zero edits for non-matching pattern', () => {
    const result = applyEditToSource('const x = 1;\n', 'typescript', {
      kind: 'remove',
      pattern: 'console.log($$$ARGS)',
    });
    expect(result.editCount).toBe(0);
  });
});

describe('editor - raw', () => {
  it('applies a raw positional edit', () => {
    const source = 'const x = 1;\n';
    const result = applyEditToSource(source, 'typescript', {
      kind: 'raw',
      edits: [{
        startPos: { line: 0, column: 6 },
        endPos: { line: 0, column: 7 },
        insertedText: 'y',
      }],
    });
    expect(result.newSource).toBe('const y = 1;\n');
    expect(result.editCount).toBe(1);
  });
});

describe('editor - formatting preservation', () => {
  it('preserves whitespace and comments outside edit ranges', () => {
    const source = [
      '// Header comment',
      '',
      'const x = 1;  // inline comment',
      '',
      'console.log("target");',
      '',
      '// Footer comment',
      '',
    ].join('\n');

    const result = applyEditToSource(source, 'typescript', {
      kind: 'replace',
      pattern: 'console.log($MSG)',
      replacement: 'logger.info($MSG)',
    });

    expect(result.newSource).toContain('// Header comment');
    expect(result.newSource).toContain('const x = 1;  // inline comment');
    expect(result.newSource).toContain('// Footer comment');
    expect(result.newSource).toContain('logger.info("target")');
  });
});

describe('editor - Python', () => {
  it('replaces print calls in Python', () => {
    const source = 'print("hello")\nprint("world")\n';
    const result = applyEditToSource(source, 'python', {
      kind: 'replace',
      pattern: 'print($MSG)',
      replacement: 'logger.info($MSG)',
    });
    expect(result.newSource).toContain('logger.info("hello")');
    expect(result.newSource).toContain('logger.info("world")');
  });

  it('renames identifiers in Python', () => {
    const source = 'x = 1\nprint(x)\ny = x + 1\n';
    const result = applyEditToSource(source, 'python', {
      kind: 'rename',
      from: 'x',
      to: 'count',
    });
    expect(result.newSource).toContain('count = 1');
    expect(result.newSource).toContain('print(count)');
    expect(result.newSource).toContain('y = count + 1');
  });
});
