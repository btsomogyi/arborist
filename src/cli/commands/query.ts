import { Command } from 'commander';
import { queryFile } from '../../engine/query.js';
import { formatQueryJson } from '../formatters/json.js';
import { formatQueryText } from '../formatters/text.js';
import '../../languages/index.js';

export function registerQueryCommand(program: Command): void {
  program
    .command('query <file>')
    .description('Query a file for AST pattern matches')
    .requiredOption('-p, --pattern <pattern>', 'ast-grep structural pattern')
    .option('-l, --language <lang>', 'Override language detection')
    .action(async (file: string, opts: { pattern: string; language?: string }, cmd: Command) => {
      try {
        const result = await queryFile(file, opts.pattern, { language: opts.language });
        const useJson = cmd.parent?.opts().json;
        if (useJson) {
          console.log(formatQueryJson(result));
        } else {
          console.log(formatQueryText(result));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${msg}`);
        process.exit(1);
      }
    });
}
