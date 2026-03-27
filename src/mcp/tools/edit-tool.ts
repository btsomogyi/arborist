import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { applyEdit } from '../../engine/editor.js';
import { createUnifiedDiff } from '../../cli/diff.js';
import { editInputSchema } from '../schemas.js';
import '../../languages/index.js';

export function registerEditTool(server: McpServer): void {
  server.tool(
    'scissorhands_edit',
    'Apply a structural edit (replace, rename, insert, or remove) to a source file',
    editInputSchema.shape,
    async (input) => {
      const result = await applyEdit(input.file, input.operation, { dryRun: input.dryRun });
      const response: Record<string, unknown> = {
        file: result.file,
        editCount: result.editCount,
        changes: result.changes,
        syntaxValid: result.syntaxValid,
      };
      if (input.dryRun && result.editCount > 0) {
        response.diff = createUnifiedDiff(input.file, result.originalSource, result.newSource);
      }
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(response, null, 2),
        }],
      };
    },
  );
}
