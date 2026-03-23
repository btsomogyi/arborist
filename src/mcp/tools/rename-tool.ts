import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { applyEdit } from '../../engine/editor.js';
import { createUnifiedDiff } from '../../cli/diff.js';
import { renameInputSchema } from '../schemas.js';
import '../../languages/index.js';

export function registerRenameTool(server: McpServer): void {
  server.tool(
    'arborist_rename',
    'Rename a symbol across a file (identifier-safe, not substring replacement)',
    renameInputSchema.shape,
    async (input) => {
      const result = await applyEdit(input.file, {
        kind: 'rename',
        from: input.from,
        to: input.to,
        scope: input.scope,
      }, { dryRun: input.dryRun });

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
