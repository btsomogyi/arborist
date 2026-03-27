# Scissorhands: Design Synthesis & Options Analysis

## Agent Research Summary

Four specialized agents conducted parallel analysis:

| Agent | Focus | Key Deliverable |
|-------|-------|-----------------|
| **Researcher** | Ecosystem survey of 30+ AST tools | Comparative matrix of all viable tools by language, edit support, formatting preservation |
| **Plan Architect** | Detailed architecture with interfaces | Full TypeScript interfaces, file layout, component designs, 6-phase implementation |
| **Goal Planner** | GOAP decomposition with risk analysis | 12 actions, dependency DAG, 6 risk items, 3 alternative paths |
| **Sublinear Goal Planner** | Optimal build-vs-reuse + MVP scope | 3-tier edit model, pattern-as-selector innovation, 8-week phased timeline |

---

## Consensus Findings

### All 4 agents agree on:

1. **tree-sitter is the foundation** — 170+ language grammars, CST preservation, byte-range editing, MIT license
2. **Byte-range splicing preserves formatting** — edits target specific byte ranges; everything outside is untouched
3. **Plugin architecture for language extensibility** — `LanguageProvider` interface that new languages implement
4. **Both CLI and MCP server** as integration surfaces for Claude Code
5. **TypeScript + one other language for MVP** — validates the provider abstraction
6. **The Edit Engine is the highest-risk component** — multi-edit ordering, conflict detection, formatting preservation

### Key Divergence: AST Backend

| Option | Advocates | Approach | Trade-offs |
|--------|-----------|----------|------------|
| **A: `@ast-grep/napi`** | Goal Planner, Sublinear Planner | Rust NAPI addon wrapping tree-sitter. Pattern syntax uses target language. `commitEdits()` handles multi-edit application. | **Pro**: Higher-level API, code-native patterns (agent-friendly), `commitEdits()` built-in, pre-compiled binaries. **Con**: ~20 built-in languages (not 170+), less control over edit pipeline. |
| **B: `web-tree-sitter`** | Plan Architect | WASM-based tree-sitter. S-expression queries. Manual byte-range splicing. | **Pro**: 170+ languages, universal portability (WASM), maximum control. **Con**: Lower-level (must build edit engine), S-expressions harder for agents, WASM slower than native. |
| **C: Hybrid** | Researcher | ast-grep for query/match + raw tree-sitter for fine-grained edits when needed. | **Pro**: Best of both. **Con**: Two dependencies, integration complexity. |

---

## Three Viable Solution Options

### Option 1: ast-grep Primary (Recommended)

**Core dependency**: `@ast-grep/napi`

**Architecture**: ast-grep handles parse + query + edit. Scissorhands adds the operation layer (rename, extract, wrap), CLI, MCP server, and language provider registry.

**Edit model**: Pattern-as-selector — agents write patterns in the target language (`console.log($MSG)` not S-expressions). Three tiers: structural patterns (primary), named operations (convenience), raw positional edits (escape hatch).

**Strengths**:
- Fastest path to MVP — `commitEdits()` solves the hardest problem
- Code-native pattern syntax is dramatically more agent-friendly
- Single dependency for parse + query + edit
- Native Rust performance via NAPI
- Pre-compiled binaries (no node-gyp)

**Weaknesses**:
- ~20 built-in languages (expandable via custom tree-sitter grammars)
- Less control over the edit pipeline internals
- Pattern syntax has edge cases between languages

**MVP scope**: TypeScript + Python, parse/query/replace/rename/insert/remove
**Estimated effort**: 6-8 weeks

```
Dependencies: @ast-grep/napi, @modelcontextprotocol/sdk, commander, zod
```

### Option 2: web-tree-sitter Foundation

**Core dependency**: `web-tree-sitter` + language-specific `.wasm` grammars

**Architecture**: tree-sitter handles parsing. Scissorhands builds the full query engine (wrapping tree-sitter queries), edit engine (byte-range splicing with ordering/conflict detection), operation layer, CLI, and MCP server.

**Edit model**: `NodeSelector` with multiple strategies (S-expression queries, node type + name, byte range, point range). Edits specified as `{ target: ByteRange, operation: replace|insert|delete, content }`.

**Strengths**:
- 170+ languages out of the box via grammar WASM files
- Maximum architectural control
- Universal portability (WASM works everywhere)
- No native compilation requirements
- Richer query capabilities via tree-sitter S-expressions

**Weaknesses**:
- Must build edit engine from scratch (the hardest part)
- S-expressions are harder for agents to write
- WASM is 2-5x slower than native (adequate for agent use, not ideal)
- More code to maintain

**MVP scope**: TypeScript + Python + Go, parse/query/edit with 7 operation types
**Estimated effort**: 8-10 weeks

```
Dependencies: web-tree-sitter, tree-sitter-typescript, tree-sitter-python,
              tree-sitter-go, @modelcontextprotocol/sdk, commander, zod
```

### Option 3: Hybrid (ast-grep + tree-sitter escape hatch)

**Core dependencies**: `@ast-grep/napi` (primary) + `web-tree-sitter` (fallback)

**Architecture**: ast-grep handles the common path (pattern-based query/edit). For languages not built into ast-grep, or for operations that need finer control, fall back to web-tree-sitter with byte-range splicing.

**Edit model**: ast-grep patterns as primary interface. S-expression queries available for advanced use. The `LanguageProvider` interface is backend-agnostic — an ast-grep provider and a tree-sitter provider both implement it.

**Strengths**:
- Best of both worlds: agent-friendly patterns + 170+ language support
- Graceful degradation for unsupported languages
- Backend-agnostic provider interface future-proofs the design

**Weaknesses**:
- Two dependencies, higher complexity
- Must maintain two provider implementations
- Integration surface between the two backends is a risk zone

**MVP scope**: TypeScript + Python (ast-grep), with tree-sitter fallback architecture in place
**Estimated effort**: 8-10 weeks (more architecture, similar feature scope)

```
Dependencies: @ast-grep/napi, web-tree-sitter, @modelcontextprotocol/sdk,
              commander, zod
```

---

## Recommendation

**Option 1 (ast-grep primary)** is the recommended starting point because:

1. **Fastest to value** — `commitEdits()` eliminates the riskiest implementation work
2. **Most agent-friendly** — code-native patterns are dramatically easier for LLMs to generate
3. **Adequate language coverage** — ast-grep supports all 4 target languages (TS, Python, Go, Rust) natively, with custom tree-sitter grammar support for others
4. **Clean upgrade path** — the `LanguageProvider` interface can be designed backend-agnostic from day 1, allowing a tree-sitter provider to be added later without changing the core API

The key architectural decision (backend-agnostic `LanguageProvider` interface) from Option 3 should be adopted regardless of which option is chosen. This preserves optionality at minimal cost.

---

## Shared Architecture Elements (All Options)

### Core Interfaces

```typescript
interface LanguageProvider {
  id: string;                    // "typescript", "python", "go"
  extensions: string[];          // [".ts", ".tsx"]
  patterns: LanguagePatterns;    // Pre-built query patterns
  nodeTypes: NodeTypeMap;        // Semantic node type mappings
  parse(source: string): ParseResult;
  query(root: ASTNode, query: Query): ASTNode[];
}

interface EditOperation {
  kind: 'replace' | 'rename' | 'insert' | 'remove' | 'wrap' | 'extract' | 'move';
  // ... kind-specific fields
}

interface EditResult {
  newSource: string;
  originalSource: string;
  editCount: number;
  changes: ChangeDescriptor[];
  syntaxValid: boolean;
}
```

### File Layout

```
scissorhands/
  src/
    core/           # Types, errors, registry
    engine/         # Parser, query, edit engines
    operations/     # High-level operations (rename, extract, etc.)
    languages/      # Language provider implementations
    cli/            # CLI commands
    mcp/            # MCP server + tools
  tests/
    unit/           # Engine and operation tests
    integration/    # CLI and MCP tests
    fixtures/       # Sample source files per language
  docs/             # Architecture docs, ADRs
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `scissorhands_parse` | Parse file, return AST structure |
| `scissorhands_query` | Find nodes matching a pattern |
| `scissorhands_edit` | Apply a single edit operation |
| `scissorhands_batch` | Apply multiple edits atomically |
| `scissorhands_list_symbols` | List functions, classes, imports |
| `scissorhands_rename` | Rename symbol across file |

### CLI Commands

```
scissorhands parse <file>
scissorhands query <file> --pattern <pattern>
scissorhands edit <file> --replace --pattern <p> --with <r>
scissorhands edit <file> --rename --from <old> --to <new>
scissorhands apply <edits.json>
scissorhands providers list
```

---

## Next Steps

1. **Choose option** (1, 2, or 3)
2. **Validate core assumption**: Build a spike — parse a TS file, query for a function, replace its body, verify formatting preserved
3. **Implement Phase 1**: Project setup, core types, parser + query engine, first language provider
4. **Implement Phase 2**: Edit engine (highest risk — validate early)
5. **Implement Phase 3**: CLI + MCP server integration

---

## Source Material

- Full researcher report: agent output (30+ tools catalogued)
- Full architecture plan: agent output (complete interfaces, component designs)
- Full GOAP plan: agent output (12 actions, dependency DAG, risk matrix)
- Sublinear plan: `docs/PLAN.md` (8-week timeline, 3-tier edit model)
