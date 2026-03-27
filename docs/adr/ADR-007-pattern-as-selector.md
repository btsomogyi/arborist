# ADR-007: Pattern-as-Selector Innovation

## Status

Accepted

## Context

Every AST-based editing tool needs a mechanism for **targeting** — identifying which nodes in the tree should be affected by an edit. The targeting mechanism is the most critical API design decision because it is what agents (and humans) interact with on every edit.

Requirements for the targeting mechanism:

1. **Agent-friendly.** LLMs must be able to generate targets reliably. The format should be one that LLMs encounter frequently in training data, minimizing hallucination risk.
2. **Human-readable.** A developer reviewing an agent's edit plan should understand what is being targeted by reading the selector.
3. **Precise.** The selector must identify exactly the intended nodes, not more, not fewer. False positives (editing unintended code) are worse than false negatives (missing a target).
4. **Composable.** Selectors should support scoping (e.g., "only inside this function") and chaining (e.g., "the return statement of the first method in the class").
5. **Language-native.** The selector should look like the language it targets. A TypeScript selector should look like TypeScript. A Python selector should look like Python.

## Decision

Use **ast-grep code-native patterns** as the universal targeting mechanism in Scissorhands. A pattern is a snippet of code in the target language with special metavariable syntax for wildcards:

- **`$NAME`** matches any single AST node and captures it as `NAME`.
- **`$$$ARGS`** matches zero or more AST nodes (variadic capture).
- **`$_`** matches any single node without capturing.

A pattern simultaneously serves three purposes:

1. **Identifies nodes.** The pattern is matched against the CST. All matching subtrees are candidate targets.
2. **Captures sub-components.** Metavariables extract parts of the match for use in replacement templates.
3. **Documents the edit.** The pattern is human-readable — it looks like the code it matches.

### Examples

**Simple match:**
```
console.log($MSG)
```
Matches every `console.log` call. Captures the argument as `$MSG`.

**Scoped match (match inside a specific context):**
```
// Match: only console.log inside async functions
async function $NAME($$$PARAMS) {
  $$$BEFORE
  console.log($MSG)
  $$$AFTER
}
```

**Replacement:**
```
match:   console.log($MSG)
replace: logger.info($MSG)
```
The replacement template reuses captured metavariables.

**Complex structural match:**
```
if ($COND) {
  return $VAL;
}
return $DEFAULT;
```
Matches an early-return-if pattern. Could be refactored to a ternary.

### Scoped Edits

Patterns can be nested to express scope. The outer pattern defines the context; the inner pattern defines the target within that context. This avoids false positives from patterns that match too broadly.

```typescript
// Scope: only inside the 'handleRequest' function
scope:  function handleRequest($$$PARAMS) { $$$BODY }
match:  console.log($MSG)
replace: logger.info($MSG)
```

### Fallback: tree-sitter S-expressions

For the tree-sitter backend (Phase 2), patterns are either:
1. Translated from code-native syntax to tree-sitter queries by the provider.
2. Accepted directly as S-expression queries for advanced use cases.

The code-native pattern syntax remains the primary and recommended interface.

## Consequences

### Positive

- **No new DSL to learn.** Patterns are written in the target language. A TypeScript developer writes TypeScript patterns. A Python developer writes Python patterns. The only new syntax is `$NAME` and `$$$NAME`.
- **LLM-generatable.** LLMs are trained on massive amounts of code. Generating a code snippet with metavariables is a trivial extension of code generation. This is far more reliable than generating XPath expressions or custom DSL queries.
- **Self-documenting.** Reading a pattern tells you exactly what code structure is being targeted. No mental translation from an abstract query language to concrete code.
- **Battle-tested.** ast-grep's pattern matching has been used in production codebases for large-scale refactoring. The semantics are well-defined and edge cases are handled.
- **Composable with scoping.** Nested patterns (scope + match) provide precise targeting without complex query combinators.

### Negative

- **Ambiguity in patterns.** A pattern like `$A + $B` might match more broadly than intended (any addition expression). Agents must write sufficiently specific patterns. The engine can warn about overly broad patterns, but cannot prevent them entirely.
- **Language-specific pattern quirks.** Pattern matching depends on the CST structure, which varies by language. A pattern that works in JavaScript may need adjustment for TypeScript (e.g., type annotations change the tree structure). Documentation must cover these differences per language.
- **Not suitable for all targeting needs.** Some targets are not structural (e.g., "the third import statement" or "all comments containing TODO"). These require Tier 3 (raw positional edits) or complementary query mechanisms.
- **tree-sitter translation complexity.** Translating code-native patterns to tree-sitter S-expression queries is non-trivial for the Phase 2 backend. Some patterns may not translate cleanly.

### Neutral

- The metavariable syntax (`$NAME`, `$$$NAME`) is borrowed directly from ast-grep. This is intentional — it avoids inventing a new convention and leverages existing documentation and community knowledge.

## Alternatives Considered

### Option 1: XPath-like Selectors

- **Pros:** Well-understood query language. Precise. Powerful combinators (axes, predicates).
- **Cons:** Not language-native. An XPath selector for a TypeScript AST node looks nothing like TypeScript. LLMs would need to learn the mapping between code constructs and XPath paths, which is error-prone. Verbose for common cases. Rejected because it is not agent-friendly.

### Option 2: Custom DSL

- **Pros:** Can be designed specifically for code targeting. Can include convenience features.
- **Cons:** Yet another DSL for users and LLMs to learn. No existing training data for LLMs. Documentation and learning curve costs. Fragile — any DSL design decision that is wrong requires breaking changes. Rejected because the marginal benefit over code-native patterns does not justify the costs.

### Option 3: tree-sitter S-Expression Queries

- **Pros:** Precise. Directly maps to tree structure. Supported natively by tree-sitter.
- **Cons:** Not human-readable. `(call_expression function: (member_expression object: (identifier) @obj property: (property_identifier) @prop) arguments: (arguments (identifier) @arg))` is the S-expression for `console.log(msg)`. LLMs can generate these, but the error rate is higher than for code-native patterns. Rejected as the primary interface; retained as an advanced fallback for the tree-sitter backend.

### Option 4: CSS-like Selectors (e.g., Unist/Hast selectors)

- **Pros:** Familiar syntax for web developers. Compact.
- **Cons:** CSS selectors are designed for document trees (HTML/XML), not code ASTs. Mapping code concepts to CSS-like selectors (e.g., `function > parameter:first-child`) is awkward and loses the "looks like code" property. Rejected because it does not fit the domain.
