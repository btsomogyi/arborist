# ADR-005: Integration Model — CLI + MCP Server + Claude Skill

## Status

Accepted

## Context

Arborist must be usable across several integration surfaces:

1. **Programmatic use** — Other Node.js libraries and tools need to import Arborist as a dependency and call its API directly.
2. **Shell and scripting** — Developers and CI pipelines need to invoke Arborist from the command line.
3. **Claude Code tool integration** — Claude Code agents interact with external tools via the Model Context Protocol (MCP). To appear as a tool in Claude Code, Arborist must expose an MCP server.
4. **Claude Code skill discoverability** — Claude Code skills provide a higher-level UX layer: slash commands, prompts, and contextual suggestions. A skill wrapper makes Arborist discoverable and ergonomic within Claude Code sessions.

Each surface has different invocation mechanics, I/O formats, and lifecycle expectations. However, the core editing logic is identical across all surfaces.

## Decision

Ship Arborist as four artifacts, all built from the same core engine:

### 1. npm Library (`arborist-core` or `@arborist/core`)

The core TypeScript library. Exports the `Engine` class, `LanguageProvider` interface, operation types, and utility functions. No CLI, no server — just the API.

```typescript
import { Engine } from '@arborist/core';
const engine = new Engine();
const result = await engine.edit(source, 'typescript', operations);
```

### 2. CLI Tool (`arborist`)

A command-line interface wrapping the core library. Invocable as `arborist` (if globally installed) or `npx arborist`. Accepts source files, operation descriptions (JSON or flags), and outputs modified source or diffs.

```bash
arborist edit src/main.ts --pattern 'console.log($MSG)' --replace 'logger.info($MSG)'
arborist rename src/main.ts --symbol foo --to bar
arborist query src/main.ts --pattern 'function $NAME($$$PARAMS) { $$$BODY }'
```

Supports `--dry-run`, `--diff`, `--in-place`, and `--json` output modes.

### 3. MCP Server (stdio transport)

An MCP server that exposes Arborist operations as MCP tools. Uses stdio transport (stdin/stdout JSON-RPC) for compatibility with Claude Code's MCP client.

Tools exposed:

- `arborist_edit` — Apply structural pattern edits (Tier 1).
- `arborist_refactor` — Apply named operations (Tier 2).
- `arborist_query` — Query the AST and return matches.
- `arborist_parse` — Parse source and return the AST structure.
- `arborist_capabilities` — List supported languages and operations.

Each tool's input schema is defined with Zod, matching the operation types from the core library. This ensures consistent validation across all integration surfaces.

### 4. Claude Code Skill Wrapper

A skill definition (`.claude/skills/arborist.md` or equivalent) that provides:

- A `/arborist` slash command for interactive use.
- System prompt context describing available operations.
- Example invocations for common tasks.

The skill delegates to the MCP server for execution.

### Shared Architecture

All four artifacts share:

- The same `Engine` instance and operation types.
- The same `LanguageProvider` registry.
- The same validation, conflict detection, and error handling logic.
- The same test fixtures (core library tests cover the engine; integration tests cover each surface).

## Consequences

### Positive

- **Single source of truth.** All integration surfaces call the same core engine. A bug fix or feature addition in the core library is immediately available everywhere.
- **Natural distribution.** npm is the standard distribution channel for Node.js tools. `npx arborist` works without global installation.
- **MCP compatibility.** Claude Code agents can discover and invoke Arborist as a tool without any special integration. The MCP server is a standard stdio process.
- **Skill discoverability.** The Claude Code skill makes Arborist a first-class citizen in Claude Code sessions, with documentation and examples available inline.

### Negative

- **Four artifacts to maintain.** Each integration surface has its own boilerplate (CLI argument parsing, MCP tool registration, skill definition). Changes to the operation model require updates in all four places.
- **MCP schema drift risk.** The Zod schemas for MCP tools must stay synchronized with the core operation types. Generating schemas from TypeScript types mitigates this.
- **Stdio transport limitations.** MCP over stdio means the server starts and stops with each Claude Code session. There is no persistent server process, so there is no opportunity for cross-session caching. This is acceptable for the MVP but may need revisiting for performance-sensitive workloads.

### Neutral

- The CLI and MCP server are thin wrappers. The majority of the code lives in the core library. The CLI adds argument parsing (~200-300 lines). The MCP server adds tool registration and JSON-RPC handling (~300-400 lines). The skill is a markdown file.

## Alternatives Considered

### Option 1: Library Only

- **Pros:** Simplest. One artifact. No CLI or server maintenance.
- **Cons:** Not usable from Claude Code (no MCP server). Not usable from shell scripts (no CLI). Limits adoption to programmatic consumers only. Rejected because it misses the primary use case (AI agent integration via MCP).

### Option 2: MCP Server Only

- **Pros:** Covers the primary use case (Claude Code integration). Single artifact.
- **Cons:** Not usable as a library by other tools. Not usable from the command line. Forces all consumers through JSON-RPC, which adds overhead for programmatic use. Rejected because it excludes non-MCP consumers.

### Option 3: CLI Only, with MCP Adapter

- **Pros:** One artifact. MCP integration via a generic CLI-to-MCP adapter (e.g., `mcp-cli-adapter`).
- **Cons:** Adapters add latency and parsing fragility. Tool schemas would be inferred from CLI help text rather than defined precisely. Rejected because it sacrifices schema precision and adds an unnecessary dependency.

### Option 4: HTTP Server Instead of stdio MCP

- **Pros:** Persistent process. Cross-session caching possible. Standard HTTP tooling for debugging.
- **Cons:** Claude Code's MCP client uses stdio transport. An HTTP server would require a separate MCP proxy or a custom transport implementation. More complex deployment (port management, process lifecycle). Rejected for the MVP; may be reconsidered if persistent caching becomes critical.
