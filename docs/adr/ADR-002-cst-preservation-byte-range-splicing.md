# ADR-002: CST Preservation via Byte-Range Splicing

## Status

Accepted

## Context

AI agents editing code must produce output that preserves all formatting, comments, whitespace, and non-structural content exactly as the original author wrote it. Traditional AST-based tools often lose this fidelity because they round-trip through an AST-to-source printer (pretty-printer), which:

1. Discards comments that are not attached to AST nodes.
2. Reformats whitespace according to the printer's rules, not the original style.
3. May reorder or normalize constructs (e.g., import sorting, brace placement).
4. Produces diffs that are larger than the actual semantic change, making code review difficult.

Both tree-sitter and ast-grep produce **Concrete Syntax Trees (CSTs)**, not abstract syntax trees. Every node in the tree carries exact byte-range positions (`startByte`, `endByte`) that map to the original source string. This positional information is the key to non-destructive editing.

## Decision

All edit operations in Arborist operate as **byte-range replacements on the original source string**. The editing pipeline is:

1. **Parse** the source to obtain a CST with byte-accurate node positions.
2. **Query** the CST to identify target nodes (via patterns, named operations, or raw positions).
3. **Compute** replacement byte ranges and new content for each edit.
4. **Sort** all edits in **reverse byte order** (highest offset first).
5. **Apply** each edit as a string splice: `source = source.slice(0, startByte) + replacement + source.slice(endByte)`.
6. **Return** the modified source string.

The source string is never regenerated from the AST. Everything outside the edit ranges is preserved byte-for-byte.

For multi-edit operations (e.g., renaming all occurrences of a symbol), **conflict detection** is required:

- Edits must not overlap. If two edits target overlapping byte ranges, the operation fails with an error rather than producing corrupt output.
- Edits are applied atomically: either all edits in a batch succeed, or none are applied.

ast-grep's `commitEdits()` implements this model natively. For the tree-sitter backend (Phase 2), this logic is implemented in the core engine.

## Consequences

### Positive

- **Byte-perfect preservation.** Comments, blank lines, trailing whitespace, mixed indentation, and all other non-structural content are preserved exactly. The only bytes that change are the ones inside edit ranges.
- **Minimal diffs.** Code review shows only the semantic changes, not reformatting noise.
- **Style agnostic.** Arborist does not need to know or enforce any formatting style. It works with any code style because it never reformats.
- **Predictable for agents.** AI agents can reason about edits in terms of "replace this range with this text" without worrying about side effects on unrelated parts of the file.

### Negative

- **Reverse-order application is mandatory.** Applying edits from bottom to top is required because each splice invalidates byte positions after the edit point. Forgetting to sort is a class of bugs that must be prevented by the core engine, not by callers.
- **Multi-edit conflict detection adds complexity.** Overlapping edits, nested edits (e.g., editing a function and also editing a statement inside it), and adjacent edits all need well-defined semantics.
- **No structural validation after edit.** Because we splice strings rather than manipulate the AST, the result is not guaranteed to be syntactically valid. A post-edit parse can catch this, but it is an extra step.
- **Insertions require anchor points.** Inserting new code (as opposed to replacing existing code) requires identifying a byte position for the insertion. The engine must provide helpers for common insertion points (before/after a node, at the start/end of a block).

### Neutral

- This approach is the same one used internally by ast-grep's `commitEdits()`, so the ast-grep backend gets this behavior for free. The tree-sitter backend requires implementing the same logic, but the algorithm is straightforward.

## Alternatives Considered

### Option 1: AST-to-Source Printing (Pretty-Printing)

- **Pros:** Guarantees syntactically valid output. Simpler conceptual model (modify the tree, print it).
- **Cons:** Destroys comments, reformats whitespace, produces large diffs, requires a language-specific printer for every supported language. Fundamentally incompatible with the goal of preserving original formatting. Rejected.

### Option 2: Patch-Based Editing (Unified Diff)

- **Pros:** Familiar format. Works with any text, not just code.
- **Cons:** Line-based, not byte-based. Cannot express edits within a single line without including the entire line. Fragile against concurrent changes. Does not leverage AST structure. Rejected because it does not provide the precision needed for structural edits.

### Option 3: Hybrid — AST Printing for New Code, Splicing for Modifications

- **Pros:** Could produce well-formatted new code while preserving existing code.
- **Cons:** Two code paths with different behaviors. Inconsistent results. Harder to reason about. The boundary between "new" and "modified" is ambiguous. Rejected in favor of the simpler uniform approach.
