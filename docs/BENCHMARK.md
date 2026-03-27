# Scissorhands Benchmark Results

Token savings analysis comparing scissorhands's AST-based editing against the
traditional Read + Edit approach used by AI agents.

## Running the Benchmarks

```bash
# Install dependencies (includes Go and Rust language support)
npm install

# Build (required — benchmarks use compiled engine)
npm run build

# Run the benchmark suite
npx vitest run tests/benchmarks/benchmark.test.ts --pool=vmForks

# Verbose output with per-test results
npx vitest run tests/benchmarks/benchmark.test.ts --pool=vmForks --reporter=verbose
```

The `--pool=vmForks` flag is required to avoid native module cleanup crashes
with the ast-grep NAPI bindings.

## Methodology

Each benchmark compares two approaches for the same code operation:

**Traditional (Read + Edit)**
1. Agent reads the entire file into its context window
2. Agent reasons about the content to locate change sites
3. Agent produces one `Edit(old_string, new_string)` call per change

**Scissorhands (single tool call)**
1. Agent sends one scissorhands tool call with a structural pattern
2. Tool returns a concise result — the file content never enters the context

Token counts use the standard ~4 characters/token approximation. The
traditional approach includes the full file content as input tokens (since
the agent must read the file), plus output tokens for each Edit call.
The scissorhands approach includes only the tool call JSON and a compact result.

## Fixture Files

| File | Language | Lines | Size |
|------|----------|------:|-----:|
| `tests/benchmarks/fixtures/sample.ts` | TypeScript | 210 | 6,629 chars |
| `tests/benchmarks/fixtures/sample.py` | Python | 192 | 6,558 chars |
| `tests/benchmarks/fixtures/sample.go` | Go | 330 | 8,533 chars |
| `tests/benchmarks/fixtures/sample.rs` | Rust | 295 | 8,572 chars |

Each fixture contains a realistic module with classes, functions, imports,
type definitions, and logging calls — the kind of code agents typically edit.

## Results

49 benchmarks, 4 languages, 6 tools. All passing.

### Overall

| Metric | Value |
|--------|------:|
| Traditional approach | 97,671 tokens |
| Scissorhands approach | 8,595 tokens |
| Tokens saved | 89,076 |
| **Overall reduction** | **91.2%** |

### Per-Tool Savings

| Tool | Avg Reduction | Explanation |
|------|-------------:|-------------|
| `scissorhands_edit` | 96.3% | One pattern replaces N manual Edit calls; no file read needed |
| `scissorhands_rename` | 95.5% | Identifier-safe rename in one call vs N string-match Edits |
| `scissorhands_batch` | 94.9% | Atomic multi-op in one call vs sequential Read+Edit cycles |
| `scissorhands_query` | 90.7% | Returns only matches vs reading the entire file to search |
| `scissorhands_list_symbols` | 77.3% | Compact symbol listing vs full file read |
| `scissorhands_parse` | 73.9% | Structured AST summary vs raw file content |

### Per-Language Savings

| Language | Avg Reduction |
|----------|-------------:|
| Go | 91.5% |
| Rust | 91.3% |
| TypeScript | 89.3% |
| Python | 89.0% |

### Full Results Table

#### TypeScript

| Scenario | Tool | Traditional | Scissorhands | Saved | Reduction |
|----------|------|----------:|--------:|------:|----------:|
| parse-file | scissorhands_parse | 1,738 | 371 | 1,367 | 78.7% |
| query-print-calls | scissorhands_query | 1,735 | 480 | 1,255 | 72.3% |
| query-classes | scissorhands_query | 1,737 | 77 | 1,660 | 95.6% |
| query-imports | scissorhands_query | 1,733 | 82 | 1,651 | 95.3% |
| replace-print-calls | scissorhands_edit | 3,192 | 100 | 3,092 | 96.9% |
| insert-doc-comment | scissorhands_edit | 1,778 | 100 | 1,678 | 94.4% |
| remove-print-calls | scissorhands_edit | 2,797 | 80 | 2,717 | 97.1% |
| rename-symbol | scissorhands_rename | 1,856 | 90 | 1,766 | 95.2% |
| list-symbols | scissorhands_list_symbols | 1,736 | 477 | 1,259 | 72.5% |
| batch-rename-remove | scissorhands_batch | 2,918 | 149 | 2,769 | 94.9% |

#### Python

| Scenario | Tool | Traditional | Scissorhands | Saved | Reduction |
|----------|------|----------:|--------:|------:|----------:|
| parse-file | scissorhands_parse | 1,721 | 392 | 1,329 | 77.2% |
| query-functions | scissorhands_query | 1,719 | 132 | 1,587 | 92.3% |
| query-print-calls | scissorhands_query | 1,718 | 446 | 1,272 | 74.0% |
| query-classes | scissorhands_query | 1,720 | 139 | 1,581 | 91.9% |
| query-imports | scissorhands_query | 1,716 | 84 | 1,632 | 95.1% |
| replace-print-calls | scissorhands_edit | 3,198 | 97 | 3,101 | 97.0% |
| insert-doc-comment | scissorhands_edit | 1,760 | 99 | 1,661 | 94.4% |
| remove-print-calls | scissorhands_edit | 2,864 | 78 | 2,786 | 97.3% |
| rename-symbol | scissorhands_rename | 1,782 | 92 | 1,690 | 94.8% |
| list-symbols | scissorhands_list_symbols | 1,719 | 519 | 1,200 | 69.8% |
| batch-rename-remove | scissorhands_batch | 2,928 | 149 | 2,779 | 94.9% |

#### Go

| Scenario | Tool | Traditional | Scissorhands | Saved | Reduction |
|----------|------|----------:|--------:|------:|----------:|
| parse-file | scissorhands_parse | 2,214 | 921 | 1,293 | 58.4% |
| query-functions | scissorhands_query | 2,212 | 99 | 2,113 | 95.5% |
| query-print-calls | scissorhands_query | 2,211 | 125 | 2,086 | 94.3% |
| query-classes | scissorhands_query | 2,213 | 160 | 2,053 | 92.8% |
| query-imports | scissorhands_query | 2,209 | 59 | 2,150 | 97.3% |
| replace-print-calls | scissorhands_edit | 2,541 | 96 | 2,445 | 96.2% |
| insert-doc-comment | scissorhands_edit | 2,258 | 108 | 2,150 | 95.2% |
| remove-print-calls | scissorhands_edit | 2,472 | 78 | 2,394 | 96.8% |
| rename-symbol | scissorhands_rename | 2,331 | 90 | 2,241 | 96.1% |
| list-symbols | scissorhands_list_symbols | 2,212 | 223 | 1,989 | 89.9% |
| batch-rename-remove | scissorhands_batch | 2,592 | 147 | 2,445 | 94.3% |

#### Rust

| Scenario | Tool | Traditional | Scissorhands | Saved | Reduction |
|----------|------|----------:|--------:|------:|----------:|
| parse-file | scissorhands_parse | 2,223 | 414 | 1,809 | 81.4% |
| query-functions | scissorhands_query | 2,221 | 122 | 2,099 | 94.5% |
| query-print-calls | scissorhands_query | 2,220 | 447 | 1,773 | 79.9% |
| query-classes | scissorhands_query | 2,222 | 143 | 2,079 | 93.6% |
| query-imports | scissorhands_query | 2,218 | 91 | 2,127 | 95.9% |
| replace-print-calls | scissorhands_edit | 3,662 | 98 | 3,564 | 97.3% |
| insert-doc-comment | scissorhands_edit | 2,262 | 104 | 2,158 | 95.4% |
| remove-print-calls | scissorhands_edit | 3,271 | 79 | 3,192 | 97.6% |
| rename-symbol | scissorhands_rename | 2,285 | 92 | 2,193 | 96.0% |
| list-symbols | scissorhands_list_symbols | 2,221 | 516 | 1,705 | 76.8% |
| batch-rename-remove | scissorhands_batch | 3,336 | 150 | 3,186 | 95.5% |

## Scenarios Tested

Each language exercises the same 10 scenarios (some languages add an 11th
if the function-declaration pattern matches):

| # | Scenario | Tool | Operation |
|---|----------|------|-----------|
| 1 | parse-file | `scissorhands_parse` | Parse file, return depth-limited AST summary |
| 2 | query-functions | `scissorhands_query` | Find all function declarations |
| 3 | query-print-calls | `scissorhands_query` | Find all print/log call sites |
| 4 | query-classes | `scissorhands_query` | Find all class/struct declarations |
| 5 | query-imports | `scissorhands_query` | Find all import statements |
| 6 | replace-print-calls | `scissorhands_edit` | Replace print/log calls with logger |
| 7 | insert-doc-comment | `scissorhands_edit` | Insert documentation before a function |
| 8 | remove-print-calls | `scissorhands_edit` | Remove all print/log statements |
| 9 | rename-symbol | `scissorhands_rename` | Rename a function across the file |
| 10 | list-symbols | `scissorhands_list_symbols` | List functions and classes |
| 11 | batch-rename-remove | `scissorhands_batch` | Atomic rename + remove in one call |

## Notes

- **Go qualified calls**: Go's `fmt.Println(...)` syntax does not match as
  an ast-grep pattern because the AST represents it as a `selector_expression`
  + `call_expression`. The Go fixture uses an unqualified `logMsg(...)` wrapper
  to exercise the same pattern-matching capability. This is a known ast-grep
  limitation with Go's qualified function calls.

- **Dynamic language registration**: Go and Rust use `@ast-grep/lang-go` and
  `@ast-grep/lang-rust` dynamic language packages. All dynamic languages must
  be registered in a single `registerDynamicLanguage()` call to avoid conflicts.

- **Token estimates scale with file size**: These fixtures are 200-330 lines.
  On larger files (1,000+ lines), the traditional approach's token cost grows
  linearly (the agent must read the entire file), while scissorhands's cost stays
  nearly constant. The savings percentage increases with file size.
