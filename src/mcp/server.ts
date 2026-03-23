import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerParseTool } from './tools/parse-tool.js';
import { registerQueryTool } from './tools/query-tool.js';
import { registerEditTool } from './tools/edit-tool.js';
import { registerBatchTool } from './tools/batch-tool.js';
import { registerListSymbolsTool } from './tools/list-symbols-tool.js';
import { registerRenameTool } from './tools/rename-tool.js';
import '../languages/index.js';

const server = new McpServer({
  name: 'arborist',
  version: '0.1.0',
});

registerParseTool(server);
registerQueryTool(server);
registerEditTool(server);
registerBatchTool(server);
registerListSymbolsTool(server);
registerRenameTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);
