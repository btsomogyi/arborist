import { Command } from 'commander';
import { applyEdit } from '../../engine/editor.js';
import { formatEditJson } from '../formatters/json.js';
import { formatEditText } from '../formatters/text.js';
import { createUnifiedDiff } from '../diff.js';
import type { EditOperation } from '../../core/types.js';
import '../../languages/index.js';

export function registerEditCommand(program: Command): void {
  program
    .command('edit <file>')
    .description('Apply a structural edit to a file')
    .option('--replace', 'Structural find-and-replace')
    .option('-p, --pattern <pattern>', 'Pattern to match')
    .option('-w, --with <replacement>', 'Replacement template')
    .option('--rename', 'Rename a symbol')
    .option('--from <name>', 'Symbol to rename from')
    .option('--to <name>', 'Symbol to rename to')
    .option('--insert', 'Insert content')
    .option('--anchor <pattern>', 'Anchor pattern for insertion')
    .option('--position <pos>', 'Insertion position: before, after, prepend, append')
    .option('--content <text>', 'Content to insert')
    .option('--remove', 'Remove matched nodes')
    .option('-m, --match-index <n>', 'Only affect the Nth match')
    .option('-s, --scope <pattern>', 'Restrict to scope matching pattern')
    .option('--dry-run', 'Show diff without modifying the file')
    .action(async (file: string, opts: Record<string, string | boolean | undefined>, cmd: Command) => {
      try {
        const operation = buildOperation(opts);
        const dryRun = !!opts.dryRun;
        const result = await applyEdit(file, operation, { dryRun });

        let diff: string | undefined;
        if (dryRun && result.editCount > 0) {
          diff = createUnifiedDiff(file, result.originalSource, result.newSource);
        }

        const useJson = cmd.parent?.opts().json;
        if (useJson) {
          console.log(formatEditJson(result, diff));
        } else {
          console.log(formatEditText(result, diff));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${msg}`);
        process.exit(1);
      }
    });
}

function buildOperation(opts: Record<string, string | boolean | undefined>): EditOperation {
  if (opts.replace) {
    if (!opts.pattern) throw new Error('--pattern is required for --replace');
    if (!opts.with) throw new Error('--with is required for --replace');
    return {
      kind: 'replace',
      pattern: opts.pattern as string,
      replacement: opts.with as string,
      matchIndex: opts.matchIndex !== undefined ? parseInt(opts.matchIndex as string, 10) : undefined,
      scope: opts.scope as string | undefined,
    };
  }
  if (opts.rename) {
    if (!opts.from) throw new Error('--from is required for --rename');
    if (!opts.to) throw new Error('--to is required for --rename');
    return {
      kind: 'rename',
      from: opts.from as string,
      to: opts.to as string,
      scope: opts.scope as string | undefined,
    };
  }
  if (opts.insert) {
    if (!opts.anchor) throw new Error('--anchor is required for --insert');
    if (!opts.position) throw new Error('--position is required for --insert');
    if (!opts.content) throw new Error('--content is required for --insert');
    return {
      kind: 'insert',
      anchor: opts.anchor as string,
      position: opts.position as 'before' | 'after' | 'prepend' | 'append',
      content: opts.content as string,
    };
  }
  if (opts.remove) {
    if (!opts.pattern) throw new Error('--pattern is required for --remove');
    return {
      kind: 'remove',
      pattern: opts.pattern as string,
      matchIndex: opts.matchIndex !== undefined ? parseInt(opts.matchIndex as string, 10) : undefined,
    };
  }
  throw new Error('One of --replace, --rename, --insert, or --remove is required');
}
