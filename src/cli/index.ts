#!/usr/bin/env node

import { Command } from 'commander';
import { version } from '../version.js';
import { registerParseCommand } from './commands/parse.js';
import { registerQueryCommand } from './commands/query.js';
import { registerEditCommand } from './commands/edit.js';
import { registerApplyCommand } from './commands/apply.js';
import { registerProvidersCommand } from './commands/providers.js';

const program = new Command();

program
  .name('scissorhands')
  .description('AST-based polyglot code editor for AI agents')
  .version(version)
  .option('--json', 'Output in JSON format')
  .option('--no-color', 'Disable colored output');

registerParseCommand(program);
registerQueryCommand(program);
registerEditCommand(program);
registerApplyCommand(program);
registerProvidersCommand(program);

program.parse();
