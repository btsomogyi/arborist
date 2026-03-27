import { describe, it, expect, beforeAll } from 'vitest';
import { needsGoContextWrap, resolvePattern } from '../../../src/engine/go-pattern-fix.js';
import { querySource } from '../../../src/engine/query.js';
import { applyEditToSource } from '../../../src/engine/editor.js';
import { registerTestProviders } from '../../helpers/register-providers.js';

beforeAll(() => {
  registerTestProviders();
});

describe('needsGoContextWrap', () => {
  it('returns true for single-dot qualified calls with args', () => {
    expect(needsGoContextWrap('fmt.Println($$$ARGS)')).toBe(true);
    expect(needsGoContextWrap('$RECV.Method($ARG)')).toBe(true);
    expect(needsGoContextWrap('http.Get($URL)')).toBe(true);
    expect(needsGoContextWrap('r.Method($$$A)')).toBe(true);
    expect(needsGoContextWrap('os.Getenv($KEY)')).toBe(true);
  });

  it('returns false for zero-arg calls (unambiguous)', () => {
    expect(needsGoContextWrap('r.method()')).toBe(false);
    expect(needsGoContextWrap('ticker.Stop()')).toBe(false);
  });

  it('returns false for multi-dot chains (unambiguous)', () => {
    expect(needsGoContextWrap('r.logger.Debug($MSG)')).toBe(false);
    expect(needsGoContextWrap('a.b.c($ARG)')).toBe(false);
  });

  it('returns false for non-qualified calls', () => {
    expect(needsGoContextWrap('foo($ARG)')).toBe(false);
    expect(needsGoContextWrap('make($TYPE, $LEN)')).toBe(false);
  });

  it('returns false for non-call patterns', () => {
    expect(needsGoContextWrap('func $NAME($$$PARAMS) { $$$BODY }')).toBe(false);
    expect(needsGoContextWrap('$NAME := $VALUE')).toBe(false);
    expect(needsGoContextWrap('type $NAME struct { $$$FIELDS }')).toBe(false);
  });

  it('returns false for patterns with syntax after the call', () => {
    expect(needsGoContextWrap('$X := fmt.Println($ARG)')).toBe(false);
    expect(needsGoContextWrap('if fmt.Println($ARG) {')).toBe(false);
  });

  it('handles whitespace in pattern', () => {
    expect(needsGoContextWrap('  fmt.Println($$$ARGS)  ')).toBe(true);
  });

  it('handles nested parens in args', () => {
    expect(needsGoContextWrap('fmt.Sprintf(string($X))')).toBe(true);
  });
});

describe('resolvePattern', () => {
  it('returns NapiConfig for affected Go patterns', () => {
    const result = resolvePattern('fmt.Println($$$ARGS)', 'go');
    expect(result).toHaveProperty('rule');
    expect((result as { rule: { pattern: { context: string } } }).rule.pattern.context)
      .toContain('fmt.Println($$$ARGS)');
  });

  it('returns plain string for non-Go languages', () => {
    const result = resolvePattern('fmt.Println($$$ARGS)', 'typescript');
    expect(result).toBe('fmt.Println($$$ARGS)');
  });

  it('returns plain string for unaffected Go patterns', () => {
    const result = resolvePattern('r.method()', 'go');
    expect(result).toBe('r.method()');
  });
});

const goSource = `package main

import "fmt"

func greet(name string) string {
	fmt.Println("Hello, " + name)
	return "Hello, " + name
}

func logTwo() {
	fmt.Println("first")
	fmt.Println("second")
}

func FormatDate(year, month, day int) string {
	return fmt.Sprintf("%04d-%02d-%02d", year, month, day)
}
`;

describe('Go query with context fix', () => {
  it('matches fmt.Println calls with args (previously broken)', () => {
    const matches = querySource(goSource, 'go', 'fmt.Println($$$ARGS)');
    expect(matches.length).toBeGreaterThanOrEqual(3);
    expect(matches[0].nodeType).toBe('call_expression');
  });

  it('captures args correctly from Go method calls', () => {
    const matches = querySource(goSource, 'go', 'fmt.Println($MSG)');
    const texts = matches.map(m => m.text);
    expect(texts).toContain('fmt.Println("first")');
    expect(texts).toContain('fmt.Println("second")');
  });

  it('matches fmt.Sprintf calls', () => {
    const matches = querySource(goSource, 'go', 'fmt.Sprintf($$$ARGS)');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].text).toContain('fmt.Sprintf');
  });

  it('still matches zero-arg calls without the fix', () => {
    const source = `package main

func main() {
	ticker.Stop()
	timer.Reset()
}
`;
    const matches = querySource(source, 'go', 'ticker.Stop()');
    expect(matches).toHaveLength(1);
  });

  it('still matches function declarations', () => {
    const matches = querySource(goSource, 'go', 'func $NAME($$$PARAMS) string { $$$BODY }');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Go editor with context fix', () => {
  it('replaces fmt.Println with log.Println', () => {
    const source = `package main

import "fmt"

func main() {
	fmt.Println("hello")
	fmt.Println("world")
}
`;
    const result = applyEditToSource(source, 'go', {
      kind: 'replace',
      pattern: 'fmt.Println($MSG)',
      replacement: 'log.Println($MSG)',
    });
    expect(result.editCount).toBe(2);
    expect(result.newSource).toContain('log.Println("hello")');
    expect(result.newSource).toContain('log.Println("world")');
    expect(result.newSource).not.toContain('fmt.Println');
  });

  it('removes fmt.Println calls', () => {
    const source = `package main

import "fmt"

func main() {
	fmt.Println("debug")
	x := 1
}
`;
    const result = applyEditToSource(source, 'go', {
      kind: 'remove',
      pattern: 'fmt.Println($$$ARGS)',
    });
    expect(result.editCount).toBe(1);
    expect(result.newSource).not.toContain('fmt.Println');
    expect(result.newSource).toContain('x := 1');
  });
});
