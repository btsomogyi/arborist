import { describe, it, expect, beforeAll } from 'vitest';
import { querySource } from '../../../src/engine/query.js';
import { ProviderError } from '../../../src/core/errors.js';
import { registerTestProviders } from '../../helpers/register-providers.js';

beforeAll(() => {
  registerTestProviders();
});

const tsSource = `
function greet(name: string) {
  console.log("Hello, " + name);
  console.log("Welcome!");
  return name;
}

const add = (a: number, b: number) => a + b;
`;

const pySource = `
def greet(name):
    print("Hello, " + name)
    print("Welcome!")
    return name

def add(a, b):
    return a + b
`;

describe('querySource - TypeScript', () => {
  it('finds console.log calls with capture', () => {
    const matches = querySource(tsSource, 'typescript', 'console.log($MSG)');
    expect(matches).toHaveLength(2);
    expect(matches[0].text).toBe('console.log("Hello, " + name)');
    expect(matches[0].captures.MSG).toBe('"Hello, " + name');
    expect(matches[1].captures.MSG).toBe('"Welcome!"');
  });

  it('returns correct node types', () => {
    const matches = querySource(tsSource, 'typescript', 'console.log($MSG)');
    expect(matches[0].nodeType).toBe('call_expression');
  });

  it('returns correct ranges', () => {
    const matches = querySource(tsSource, 'typescript', 'console.log($MSG)');
    expect(matches[0].range.start.line).toBeGreaterThan(0);
    expect(matches[0].byteRange.startByte).toBeGreaterThan(0);
  });

  it('populates context (parent chain)', () => {
    const matches = querySource(tsSource, 'typescript', 'console.log($MSG)');
    expect(matches[0].context.length).toBeGreaterThan(0);
    expect(matches[0].context).toContain('expression_statement');
  });

  it('returns empty array for non-matching pattern', () => {
    const matches = querySource(tsSource, 'typescript', 'nonexistent.call()');
    expect(matches).toHaveLength(0);
  });

  it('supports variadic captures', () => {
    const matches = querySource(
      'function foo(a, b, c) { return a; }',
      'typescript',
      'function $NAME($$$PARAMS) { $$$BODY }',
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].captures.NAME).toBe('foo');
    expect(matches[0].captures.PARAMS).toContain('a');
  });

  it('respects maxMatches', () => {
    const all = querySource(tsSource, 'typescript', 'console.log($MSG)');
    const limited = querySource(tsSource, 'typescript', 'console.log($MSG)', 1);
    expect(all).toHaveLength(2);
    expect(limited).toHaveLength(1);
  });
});

describe('querySource - Python', () => {
  it('finds print calls', () => {
    const matches = querySource(pySource, 'python', 'print($MSG)');
    expect(matches).toHaveLength(2);
  });

  it('finds function definitions', () => {
    const matches = querySource(pySource, 'python', 'def $NAME($$$PARAMS)');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe('querySource - errors', () => {
  it('throws ProviderError for unknown language', () => {
    expect(() => querySource('code', 'unknown', 'pattern')).toThrow(ProviderError);
  });
});
