import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { applyEdit } from '../../engine/editor.js';
import { batchInputSchema } from '../schemas.js';
import type { EditResult, BatchEditResult } from '../../core/types.js';
import '../../languages/index.js';

export function registerBatchTool(server: McpServer): void {
  server.tool(
    'scissorhands_batch',
    'Apply multiple edits atomically across files',
    batchInputSchema.shape,
    async (input) => {
      const results: EditResult[] = [];
      const errors: Array<{ file: string; error: string }> = [];

      for (const edit of input.edits) {
        try {
          const result = await applyEdit(edit.file, edit.operation, { dryRun: input.dryRun });
          results.push(result);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ file: edit.file, error: msg });
        }
      }

      const batchResult: BatchEditResult = {
        results,
        totalEdits: results.reduce((sum, r) => sum + r.editCount, 0),
        filesModified: new Set(results.filter(r => r.editCount > 0).map(r => r.file)).size,
        allSucceeded: errors.length === 0,
        errors,
      };

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(batchResult, null, 2),
        }],
      };
    },
  );
}
