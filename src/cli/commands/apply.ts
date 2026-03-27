import { readFile } from 'node:fs/promises';
import { Command } from 'commander';
import { applyEdit } from '../../engine/editor.js';
import { formatBatchJson } from '../formatters/json.js';
import type { ScissorhandsEdit, BatchEditResult, EditResult } from '../../core/types.js';
import '../../languages/index.js';

export function registerApplyCommand(program: Command): void {
  program
    .command('apply <edits-file>')
    .description('Apply batch edits from a JSON file')
    .option('--dry-run', 'Show diffs without modifying files')
    .action(async (editsFile: string, opts: { dryRun?: boolean }, cmd: Command) => {
      try {
        const raw = await readFile(editsFile, 'utf-8');
        let parsed: { edits: ScissorhandsEdit[] };
        try {
          parsed = JSON.parse(raw);
        } catch {
          console.error('Error: Invalid JSON in edits file');
          process.exit(1);
          return;
        }

        if (!Array.isArray(parsed.edits)) {
          console.error('Error: edits file must contain an "edits" array');
          process.exit(1);
          return;
        }

        const results: EditResult[] = [];
        const errors: Array<{ file: string; error: string }> = [];

        for (const edit of parsed.edits) {
          try {
            const result = await applyEdit(edit.file, edit.operation, { dryRun: !!opts.dryRun });
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

        const useJson = cmd.parent?.opts().json;
        if (useJson) {
          console.log(formatBatchJson(batchResult));
        } else {
          console.log(`Files modified: ${batchResult.filesModified}`);
          console.log(`Total edits: ${batchResult.totalEdits}`);
          if (errors.length > 0) {
            console.error(`Errors: ${errors.length}`);
            for (const e of errors) {
              console.error(`  ${e.file}: ${e.error}`);
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${msg}`);
        process.exit(1);
      }
    });
}
