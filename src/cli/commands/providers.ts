import { Command } from 'commander';
import { registry } from '../../core/language-registry.js';
import { formatProvidersJson } from '../formatters/json.js';
import { formatProvidersText } from '../formatters/text.js';
import '../../languages/index.js';

export function registerProvidersCommand(program: Command): void {
  program
    .command('providers')
    .description('List registered language providers')
    .action((_opts: unknown, cmd: Command) => {
      const providers = registry.list();
      const useJson = cmd.parent?.opts().json;
      if (useJson) {
        console.log(formatProvidersJson(providers));
      } else {
        console.log(formatProvidersText(providers));
      }
    });
}
