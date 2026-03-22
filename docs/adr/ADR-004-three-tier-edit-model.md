# ADR-004: Three-Tier Edit Model

## Status

Accepted

## Context

AI agents interacting with Arborist need to express code edits at varying levels of abstraction. Some agents reason at the level of structural patterns ("replace every `console.log($MSG)` with `logger.info($MSG)`"). Others reason at the level of named refactorings ("rename `foo` to `bar`"). Others need a raw escape hatch ("replace bytes 142-168 with this string").

A single abstraction level forces either too much ceremony for simple edits or too little structure for complex refactorings. The edit API must accommodate all three use cases without conflating them.

## Decision

Arborist exposes a **three-tier edit model**, ordered from most structural to most raw:

### Tier 1: Structural Pattern Edits

Pattern-based find-and-replace using ast-grep's code-native pattern syntax. The edit is expressed as a pair of patterns: a **match pattern** that identifies target nodes and a **replacement template** that defines the new code.

```
match:    console.log($MSG)
replace:  logger.info($MSG)
```

Patterns support `$CAPTURES` (single node), `$$$CAPTURES` (variadic), and can be scoped to specific AST contexts (e.g., "only inside functions named `handler`"). This tier is the most agent-friendly because patterns look like the code they target. LLMs can generate and verify them by visual inspection.

### Tier 2: Named Operations

A fixed set of high-level, parameterized refactoring operations:

- **`rename`** — Rename a symbol across its scope.
- **`extract`** — Extract a selection into a function/variable/constant.
- **`wrap`** — Wrap a node in a new construct (e.g., wrap expression in `try/catch`).
- **`insert`** — Insert a new node before/after/inside a target.
- **`remove`** — Remove a node and clean up surrounding syntax (commas, semicolons).
- **`move`** — Move a node to a different location in the file.
- **`changeSignature`** — Add, remove, or reorder function parameters.

Each operation is implemented per language via the `LanguageProvider` (ADR-003). Operations accept structured parameters (target selector, new name, insertion position, etc.) rather than raw text.

### Tier 3: Raw Positional Edits

Direct byte-range or line-range replacements on the source string. No AST awareness. The caller specifies:

- A byte range (`startByte`, `endByte`) or line range (`startLine`, `endLine`).
- The replacement string.

This tier is the escape hatch for cases where the AST does not capture the relevant structure (e.g., editing comments, modifying string literals, adjusting whitespace).

### Tier Interaction

All three tiers ultimately resolve to byte-range replacements (ADR-002). The execution pipeline is:

1. Tier 1 patterns are matched against the CST to produce byte ranges and interpolated replacement strings.
2. Tier 2 operations are decomposed by the language provider into one or more byte-range replacements.
3. Tier 3 edits are already byte-range replacements.
4. All resulting byte-range replacements are sorted, validated for conflicts, and applied atomically.

A single edit request can mix tiers (e.g., a Tier 2 rename plus a Tier 1 pattern replacement), and they are applied as one atomic batch.

## Consequences

### Positive

- **Right tool for the job.** Agents choose the abstraction level that matches their reasoning. Pattern-heavy agents use Tier 1. Refactoring-oriented agents use Tier 2. Agents doing text manipulation use Tier 3.
- **Composable.** Multi-tier edits compose naturally because they all reduce to byte ranges.
- **Progressive disclosure.** New users start with Tier 2 (named operations are self-explanatory). Power users graduate to Tier 1 (patterns). Tier 3 is documented as the escape hatch.
- **LLM-friendly.** Tier 1 patterns are readable, verifiable, and generatable by LLMs. Tier 2 operations have structured schemas that fit well in tool-call formats.

### Negative

- **Larger API surface.** Three tiers means more documentation, more validation logic, and more test coverage than a single-tier model.
- **Tier 2 operations are language-specific.** Each named operation must be implemented per language provider. "Extract function" in Python is structurally different from "extract function" in Go. This is a significant implementation cost.
- **Tier ambiguity.** Some edits could be expressed at multiple tiers. The documentation must provide clear guidance on when to use each tier.

### Neutral

- Tier 3 (raw positional edits) does not benefit from AST awareness. This is by design — it is the escape hatch. Callers using Tier 3 accept responsibility for syntactic correctness.

## Alternatives Considered

### Option 1: Pattern-Only API (Tier 1 Only)

- **Pros:** Simplest API. Uniform model. Patterns are powerful enough for most edits.
- **Cons:** Some refactorings (e.g., "extract function") are extremely difficult to express as pattern pairs. Agents that reason about named refactorings must translate to patterns, which is error-prone. No escape hatch for non-structural edits. Rejected because it is insufficient for the full range of use cases.

### Option 2: Named Operations Only (Tier 2 Only)

- **Pros:** Most user-friendly. Familiar vocabulary (rename, extract, wrap).
- **Cons:** Cannot cover every possible edit. Would need a constantly growing set of operation types. Patterns are more expressive and more concise for many edits. Rejected because it is not expressive enough.

### Option 3: Raw Edits Only (Tier 3 Only)

- **Pros:** Simplest implementation. Maximum flexibility.
- **Cons:** No structural awareness. Agents must compute byte ranges themselves, which requires them to parse the code independently. Defeats the purpose of an AST-based editor. Rejected because it provides no value over plain string manipulation.

### Option 4: Two Tiers (Patterns + Raw)

- **Pros:** Simpler than three tiers. Covers most use cases.
- **Cons:** Named operations like "rename" are common enough to warrant first-class support. Without Tier 2, every rename is a pattern edit with scope-aware multi-match, which is more complex for callers. Rejected in favor of the full three-tier model, though this remains a viable simplification if Tier 2 proves too costly to implement.
