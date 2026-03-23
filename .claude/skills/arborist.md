---
name: arborist
description: AST-based structural code editing for targeted, formatting-preserving changes
tools:
  - arborist_parse
  - arborist_query
  - arborist_edit
  - arborist_batch
  - arborist_list_symbols
  - arborist_rename
triggers:
  - "structural edit"
  - "rename symbol"
  - "find and replace pattern"
  - "AST query"
  - "list functions"
  - "list symbols"
  - "code pattern"
---

# Arborist: Structural Code Editor

Arborist provides AST-aware code editing that preserves formatting,
comments, and whitespace. Use it for targeted structural changes where
precision matters.

## When to Use Arborist vs Built-in Tools

### Use Arborist When:
- Renaming a symbol across a file (changes only identifier nodes, not substrings)
- Replacing a structural pattern (e.g., all `console.log(X)` -> `logger.info(X)`)
- Inserting code at a structurally meaningful location (before/after a function)
- Removing specific code structures (a function, an import, a class method)
- You need to query the AST to understand code structure
- You need batch edits applied atomically
- Formatting preservation is critical

### Use the Built-in Edit Tool When:
- Simple text replacement on a single line
- Adding/removing a single line in a known location
- The change is small and does not require structural awareness
- You already know the exact line numbers

### Use the Built-in Write Tool When:
- Creating a new file from scratch
- Rewriting an entire file

## Pattern Syntax

Arborist uses code-native patterns. Write the pattern in the same language
as the code you are editing.

### TypeScript/JavaScript Examples

| Pattern | Matches |
|---------|---------|
| `console.log($MSG)` | Any single-argument console.log call |
| `console.log($$$ARGS)` | Any console.log call (any number of args) |
| `function $NAME($$$PARAMS) { $$$BODY }` | Named function declarations |
| `const $NAME = ($$$PARAMS) => $BODY` | Arrow functions |
| `import $$$IMPORTS from $SOURCE` | Import statements |
| `class $NAME extends $BASE { $$$BODY }` | Class with extends |

### Python Examples

| Pattern | Matches |
|---------|---------|
| `print($$$ARGS)` | Any print call |
| `def $NAME($$$PARAMS):` | Function definitions |
| `class $NAME:` | Class definitions |
| `from $MODULE import $$$NAMES` | From-import statements |
| `@$DECORATOR` | Decorator applications |

### Capture Variables
- `$NAME` captures a single AST node
- `$$$NAME` captures zero or more nodes (variadic)
- Captures can be reused in replacement templates

## Tool Usage Examples

### Query for functions
```json
{
  "tool": "arborist_query",
  "input": {
    "file": "src/auth.ts",
    "pattern": "function $NAME($$$PARAMS) { $$$BODY }"
  }
}
```

### Rename a symbol
```json
{
  "tool": "arborist_rename",
  "input": {
    "file": "src/auth.ts",
    "from": "isValid",
    "to": "isAuthenticated"
  }
}
```

### Structural replace
```json
{
  "tool": "arborist_edit",
  "input": {
    "file": "src/auth.ts",
    "operation": {
      "kind": "replace",
      "pattern": "console.log($MSG)",
      "replacement": "logger.info($MSG)"
    }
  }
}
```

### Insert a JSDoc comment before a function
```json
{
  "tool": "arborist_edit",
  "input": {
    "file": "src/auth.ts",
    "operation": {
      "kind": "insert",
      "anchor": "function authenticate($$$PARAMS) { $$$BODY }",
      "position": "before",
      "content": "/** Authenticates the user session. */"
    }
  }
}
```

### Remove all console.log calls
```json
{
  "tool": "arborist_edit",
  "input": {
    "file": "src/auth.ts",
    "operation": {
      "kind": "remove",
      "pattern": "console.log($$$ARGS)"
    }
  }
}
```

### Batch edit (atomic)
```json
{
  "tool": "arborist_batch",
  "input": {
    "edits": [
      {
        "file": "src/auth.ts",
        "operation": { "kind": "rename", "from": "isValid", "to": "isAuthenticated" }
      },
      {
        "file": "src/utils.ts",
        "operation": { "kind": "remove", "pattern": "console.log($$$ARGS)" }
      }
    ]
  }
}
```

### List all symbols in a file
```json
{
  "tool": "arborist_list_symbols",
  "input": {
    "file": "src/auth.ts",
    "symbolTypes": ["function", "class"]
  }
}
```

### Dry-run (preview changes)
Add `"dryRun": true` to any edit operation to see a diff without modifying
the file.

## Error Handling

If a pattern does not match anything, the tool returns zero matches (not an
error). If a pattern has a syntax error, the tool returns an error with the
invalid pattern and a suggestion. If edits overlap, the batch is rejected
with an EDIT_CONFLICT error.
