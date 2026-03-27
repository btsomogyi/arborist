import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { parseFile } from '../../engine/parser.js';
import { parseInputSchema } from '../schemas.js';
import '../../languages/index.js';

export function registerParseTool(server: McpServer): void {
  server.tool(
    'scissorhands_parse',
    'Parse a source file and return its AST structure',
    parseInputSchema.shape,
    async (input) => {
      const result = await parseFile(input.file, { maxDepth: input.depth });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            file: result.file,
            language: result.language,
            root: result.root,
            sourceLength: result.sourceLength,
            lineCount: result.lineCount,
          }, null, 2),
        }],
      };
    },
  );
}
