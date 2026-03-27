/**
 * Workaround for tree-sitter-go's method-call vs type-conversion ambiguity.
 *
 * Go's grammar makes `recv.Method(args)` and `pkg.Type(value)` syntactically
 * identical. When ast-grep parses a standalone pattern like `fmt.Println($$$ARGS)`,
 * tree-sitter-go may interpret it as a type conversion, causing zero matches.
 *
 * Fix: wrap the pattern in a function body context so tree-sitter sees it as a
 * call expression, then use the `selector` field to extract just the call node.
 *
 * Upstream refs: ast-grep #646, #2347; tree-sitter-go #53, #186
 */

import type { NapiConfig } from '@ast-grep/napi';

/**
 * Detects patterns affected by the ambiguity.
 *
 * Affected: standalone single-dot qualified calls with arguments
 *   `fmt.Println($$$ARGS)`, `$RECV.Method($ARG)`, `http.Get($URL)`
 *
 * Not affected:
 *   - Zero-arg calls: `r.method()` — unambiguous to tree-sitter
 *   - Multi-dot chains: `r.obj.method(arg)` — no 3-part qualified types in Go
 *   - Non-qualified calls: `foo(arg)` — no dot
 *   - Larger patterns: `x := r.Method(arg)` — surrounding syntax disambiguates
 */
export function needsGoContextWrap(pattern: string): boolean {
  const trimmed = pattern.trim();

  // Match: <ident-or-metavar>.<ident-or-metavar>(
  // Metavars: $NAME, $$NAME, $$$NAME
  const prefixMatch = trimmed.match(
    /^(\${0,3}[A-Za-z_]\w*)\.(\${0,3}[A-Za-z_]\w*)\(/,
  );
  if (!prefixMatch) return false;

  const afterOpen = trimmed.slice(prefixMatch[0].length);

  // Empty args — zero-arg calls are unambiguous, no fix needed
  if (afterOpen.startsWith(')')) return false;

  // Find the matching close paren
  let depth = 1;
  let i = 0;
  while (i < afterOpen.length && depth > 0) {
    if (afterOpen[i] === '(') depth++;
    if (afterOpen[i] === ')') depth--;
    i++;
  }

  // Pattern must end at the closing paren (standalone call expression)
  return depth === 0 && afterOpen.slice(i).trim() === '';
}

/**
 * Wraps a Go pattern in a function body context, selecting `call_expression`.
 */
export function buildGoContextConfig(pattern: string): NapiConfig {
  return {
    rule: {
      pattern: {
        context: `func _() {\n${pattern}\n}`,
        selector: 'call_expression',
      },
    },
  };
}

/**
 * Returns the appropriate matcher for find/findAll.
 * Applies the Go context workaround when needed; passes through otherwise.
 */
export function resolvePattern(
  pattern: string,
  language: string,
): string | NapiConfig {
  if (language === 'go' && needsGoContextWrap(pattern)) {
    return buildGoContextConfig(pattern);
  }
  return pattern;
}
