# Adding Language Support to Arborist

Arborist uses [`@ast-grep/napi`](https://ast-grep.github.io/reference/api.html) as its
parsing and pattern-matching engine. Languages fall into two categories:

1. **Built-in languages** — shipped with `@ast-grep/napi` (TypeScript, JavaScript, TSX, JSX, CSS, HTML)
2. **Dynamic languages** — loaded at runtime via `registerDynamicLanguage()` from separate `@ast-grep/lang-*` packages

## Quick Reference

| Language | Package | astGrepLang value | Registration |
|----------|---------|-------------------|--------------|
| TypeScript | `@ast-grep/napi` (built-in) | `TypeScript` | Built-in |
| JavaScript | `@ast-grep/napi` (built-in) | `JavaScript` | Built-in |
| TSX | `@ast-grep/napi` (built-in) | `Tsx` | Built-in |
| JSX | `@ast-grep/napi` (built-in) | `Jsx` | Built-in |
| Python | `@ast-grep/lang-python` | `Python` | Dynamic |
| Go | `@ast-grep/lang-go` | `Go` | Dynamic |
| Rust | `@ast-grep/lang-rust` | `Rust` | Dynamic |
| C | `@ast-grep/lang-c` | `C` | Dynamic |
| Java | `@ast-grep/lang-java` | `Java` | Dynamic |

See [ast-grep/langs](https://github.com/ast-grep/langs) for the full list.

## Step-by-Step: Adding a New Language

### 1. Install the language grammar package

```bash
npm install @ast-grep/lang-<language>
```

For example, to add Go:

```bash
npm install @ast-grep/lang-go
```

### 2. Register the dynamic language in `src/engine/parser.ts`

Add an import for the language grammar and register it alongside Python:

```typescript
import go from '@ast-grep/lang-go';

// In the ensureDynamicLanguages() function (or extend the existing pattern):
registerDynamicLanguage({ python, go });
```

**Important**: `registerDynamicLanguage()` accepts an object where each key is the
language name (lowercase) and each value is the grammar module's default export.
The call must happen before any `parse()` call for that language.

### 3. Create the language provider in `src/languages/<language>.ts`

Create a new file that exports a `LanguageProvider` object:

```typescript
import type { LanguageProvider } from '../core/types.js';

export const goProvider: LanguageProvider = {
  id: 'go',
  displayName: 'Go',
  extensions: ['.go'],
  astGrepLang: 'Go',  // Must match the registered language name
  patterns: {
    // Patterns use the target language's own syntax.
    // $NAME captures a single node, $$$NAME captures multiple nodes.
    functionDeclaration: 'func $NAME($$$PARAMS) $$$BODY',
    classDeclaration: 'type $NAME struct { $$$BODY }',
    variableDeclaration: 'var $NAME = $VALUE',
    importStatement: 'import $$$IMPORTS',
    exportStatement: 'func $NAME($$$PARAMS) $$$BODY',
    // Add language-specific patterns:
    interfaceDeclaration: 'type $NAME interface { $$$BODY }',
    goroutine: 'go $FUNC($$$ARGS)',
  },
  nodeTypes: {
    function: ['function_declaration', 'method_declaration'],
    class: ['type_declaration'],
    variable: ['var_declaration', 'short_var_declaration'],
    import: ['import_declaration'],
    parameter: ['parameter_declaration'],
    identifier: ['identifier', 'field_identifier', 'type_identifier'],
  },
};
```

#### How to discover patterns and node types

1. **Use ast-grep's playground**: https://ast-grep.github.io/playground.html
2. **Parse a sample file** and inspect the AST:
   ```typescript
   import { parseLangSource, sgNodeToASTNode } from './engine/parser.js';
   const root = parseLangSource('func main() {}', 'Go');
   console.log(JSON.stringify(sgNodeToASTNode(root.root(), 5), null, 2));
   ```
3. **Check tree-sitter grammar docs** for the language's node type names.

### 4. Register the provider in `src/languages/index.ts`

```typescript
import { goProvider } from './go.js';

export function registerBuiltinProviders(): void {
  // ... existing registrations ...
  if (!registry.has('go')) {
    registry.register(goProvider);
  }
}

export { goProvider } from './go.js';
```

### 5. Add to `tsup.config.ts` externals

Native language grammar packages must not be bundled:

```typescript
external: ['@ast-grep/napi', '@ast-grep/lang-python', '@ast-grep/lang-go'],
```

### 6. Write tests

Create `tests/unit/languages/<language>.test.ts`:

- Verify the provider has correct id, extensions, and astGrepLang value
- Verify all patterns match at least once against a representative fixture
- Verify node type mappings are non-empty

Create a fixture file `tests/fixtures/<language>/` with representative source code.

### 7. Verify

```bash
npm run typecheck   # Types compile
npm test            # All tests pass
npm run build       # Build succeeds
```

## Version Compatibility

The `@ast-grep/lang-*` packages must be compatible with the installed version of
`@ast-grep/napi`. Incompatible tree-sitter grammar ABI versions will cause a runtime
panic (`IncompatibleVersion` error).

**Rule**: When upgrading `@ast-grep/napi`, also upgrade all `@ast-grep/lang-*` packages
to their latest versions. Check the [ast-grep/langs releases](https://github.com/ast-grep/langs/releases)
for compatibility notes.

## Built-in vs Dynamic Language Parsing

Built-in languages use dedicated parser helpers (`ts.parse()`, `js.parse()`, etc.)
for optimal performance. Dynamic languages use the generic `parse(langName, source)`
function after registration.

The `parseLangSource()` function in `src/engine/parser.ts` handles this routing
automatically — built-in languages are dispatched to their dedicated parsers, while
all others go through the dynamic registration path.
