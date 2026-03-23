import { describe, it, expect, beforeAll } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerParseTool } from '../../../src/mcp/tools/parse-tool.js';
import { registerQueryTool } from '../../../src/mcp/tools/query-tool.js';
import { registerEditTool } from '../../../src/mcp/tools/edit-tool.js';
import { registerBatchTool } from '../../../src/mcp/tools/batch-tool.js';
import { registerListSymbolsTool } from '../../../src/mcp/tools/list-symbols-tool.js';
import { registerRenameTool } from '../../../src/mcp/tools/rename-tool.js';
import { registerBuiltinProviders } from '../../../src/languages/index.js';

beforeAll(() => {
  registerBuiltinProviders();
});

describe('MCP Server', () => {
  it('registers all 6 tools without error', () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    expect(() => {
      registerParseTool(server);
      registerQueryTool(server);
      registerEditTool(server);
      registerBatchTool(server);
      registerListSymbolsTool(server);
      registerRenameTool(server);
    }).not.toThrow();
  });
});
