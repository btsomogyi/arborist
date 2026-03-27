import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { queryFile } from '../../engine/query.js';
import { queryInputSchema } from '../schemas.js';
import '../../languages/index.js';

export function registerQueryTool(server: McpServer): void {
  server.tool(
    'scissorhands_query',
    'Query a source file for AST pattern matches',
    queryInputSchema.shape,
    async (input) => {
      const result = await queryFile(input.file, input.pattern, {
        language: input.language,
      });
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            file: result.file,
            language: result.language,
            matches: result.matches,
            matchCount: result.matchCount,
          }, null, 2),
        }],
      };
    },
  );
}
