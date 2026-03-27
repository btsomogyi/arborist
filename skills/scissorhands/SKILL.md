---
name: scissorhands
description: Performs AST-based structural code edits across TypeScript, Python, Go, and Rust using pattern-as-selector syntax. Use when making targeted refactors, renaming symbols, inserting or removing code by structural pattern, or querying AST nodes — without rewriting entire files.
---

<objective>
Applies surgical, structure-aware edits to source code files via 6 MCP tools powered by ast-grep and tree-sitter. Edits target AST nodes using patterns written in the language itself (e.g., `console.log($MSG)`), preserving all surrounding formatting, comments, and whitespace. Supports TypeScript/JavaScript/JSX/TSX, Python, Go, and Rust.
</objective>

<quick_start>
**Setup** (MCP server must be registered first):

```bash
claude mcp add scissorhands -- npx -y scissorhands-mcp
```

**Common operations:**

Replace a pattern:
```json
scissorhands_edit({
  "file": "src/app.ts",
  "operation": {
    "kind": "replace",
    "pattern": "console.log($MSG)",
    "replacement": "logger.info($MSG)"
  }
})
```

Rename a symbol:
```json
scissorhands_rename({
  "file": "src/app.ts",
  "from": "oldName",
  "to": "newName"
})
```

Find all matches of a pattern:
```json
scissorhands_query({
  "file": "src/app.ts",
  "pattern": "function $NAME($$$PARAMS) { $$$BODY }"
})
```
</quick_start>

<tools>
Six MCP tools are available after registering the scissorhands server:

| Tool | Purpose |
|------|---------|
| `scissorhands_parse` | Parse a file and return its AST structure |
| `scissorhands_query` | Find AST nodes matching a structural pattern |
| `scissorhands_edit` | Apply a single structural edit (replace, rename, insert, remove) |
| `scissorhands_batch` | Apply multiple edits atomically across files |
| `scissorhands_list_symbols` | Extract function, class, variable, import, export, and type definitions |
| `scissorhands_rename` | Rename an identifier across a file with optional scope restriction |
</tools>

<patterns>
Patterns use the target language's own syntax with capture variables:

- **`$NAME`** — captures a single AST node (identifier, expression, literal)
- **`$$$NAME`** — captures zero or more nodes (parameter lists, statement blocks)

**Examples by language:**

TypeScript/JavaScript:
- `console.log($MSG)` — matches any console.log call
- `function $NAME($$$PARAMS) { $$$BODY }` — matches function declarations
- `const $VAR = $VALUE` — matches const declarations
- `if ($COND) { $$$THEN }` — matches if statements

Python:
- `def $NAME($$$PARAMS): $$$BODY` — matches function definitions
- `import $MODULE` — matches import statements
- `for $VAR in $ITER: $$$BODY` — matches for loops

Go:
- `func $NAME($$$PARAMS) $RET { $$$BODY }` — matches function declarations
- `fmt.Println($MSG)` — matches print calls

Rust:
- `fn $NAME($$$PARAMS) -> $RET { $$$BODY }` — matches function declarations
- `println!($MSG)` — matches println macro calls
</patterns>

<operations>
**replace** — Find nodes matching a pattern and replace with a template. Captures from the pattern are available in the replacement as `$NAME`.
```json
{
  "kind": "replace",
  "pattern": "console.log($MSG)",
  "replacement": "logger.info($MSG)",
  "matchIndex": 0,
  "scope": "function handleRequest($$$PARAMS) { $$$BODY }"
}
```
`matchIndex` targets the Nth match only. `scope` restricts matching to within a parent pattern.

**rename** — Rename all occurrences of an identifier.
```json
{
  "kind": "rename",
  "from": "oldName",
  "to": "newName",
  "scope": "class MyClass { $$$BODY }"
}
```

**insert** — Add content before, after, or inside a matched node.
```json
{
  "kind": "insert",
  "anchor": "function $NAME($$$PARAMS) { $$$BODY }",
  "position": "before",
  "content": "/** @deprecated Use newFunction instead */"
}
```
Positions: `before`, `after`, `prepend` (inside, at start), `append` (inside, at end).

**remove** — Delete nodes matching a pattern.
```json
{
  "kind": "remove",
  "pattern": "console.log($MSG)",
  "matchIndex": 0
}
```
</operations>

<workflow>
1. **Explore structure** — Use `scissorhands_list_symbols` to understand what's in a file before editing
2. **Query first** — Use `scissorhands_query` to verify a pattern matches the intended nodes before applying edits
3. **Dry run** — Set `"dryRun": true` on edit/batch/rename operations to preview changes without writing
4. **Apply** — Run the edit with `dryRun` omitted or `false`
5. **Batch when possible** — Use `scissorhands_batch` to apply multiple related edits atomically

Always query before editing unfamiliar code. Always dry-run destructive edits (remove, large-scale replace) before committing.
</workflow>

<anti_patterns>
- Do not use scissorhands for simple text replacements that have no structural meaning — use a standard find-and-replace instead
- Do not write patterns that rely on whitespace or formatting — patterns match AST structure, not text
- Do not chain many single `scissorhands_edit` calls when `scissorhands_batch` can apply them atomically
- Do not skip the query step when a pattern might over-match — verify matches first
- Do not use `scissorhands_parse` with unlimited depth on large files — set `depth` to 3-5 for overview, deeper only for targeted subtrees
</anti_patterns>

<success_criteria>
- Edit operations modify only the targeted AST nodes; surrounding code is byte-identical
- Pattern captures (`$NAME`, `$$$PARAMS`) are correctly substituted in replacements
- Dry-run output matches the intended change before applying
- Batch edits apply atomically — all succeed or none are written
- No formatting, comments, or whitespace outside the edit range is altered
</success_criteria>
