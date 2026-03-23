import { Command } from 'commander';
import { parseFile } from '../../engine/parser.js';
import { formatParseJson } from '../formatters/json.js';
import { formatParseText } from '../formatters/text.js';
import '../../languages/index.js';

export function registerParseCommand(program: Command): void {
  program
    .command('parse <file>')
    .description('Parse a file and display its AST')
    .option('-d, --depth <n>', 'Maximum AST depth to display', '5')
    .option('--node-types <types>', 'Filter to specific node types (comma-separated)')
    .action(async (file: string, opts: { depth: string; nodeTypes?: string }, cmd: Command) => {
      try {
        const depth = parseInt(opts.depth, 10);
        const result = await parseFile(file, { maxDepth: depth });
        const useJson = cmd.parent?.opts().json;
        if (useJson) {
          console.log(formatParseJson(result));
        } else {
          console.log(formatParseText(result, depth));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${msg}`);
        process.exit(1);
      }
    });
}
