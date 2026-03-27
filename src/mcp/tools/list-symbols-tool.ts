import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { queryFile } from '../../engine/query.js';
import { registry } from '../../core/language-registry.js';
import { listSymbolsInputSchema } from '../schemas.js';
import '../../languages/index.js';

interface SymbolInfo {
  name: string;
  type: string;
  range: { start: { line: number; column: number }; end: { line: number; column: number } };
  signature: string;
}

const symbolPatternMap: Record<string, string> = {
  function: 'functionDeclaration',
  class: 'classDeclaration',
  variable: 'variableDeclaration',
  import: 'importStatement',
  export: 'exportStatement',
};

export function registerListSymbolsTool(server: McpServer): void {
  server.tool(
    'scissorhands_list_symbols',
    'List symbols (functions, classes, variables, imports, exports) in a source file',
    listSymbolsInputSchema.shape,
    async (input) => {
      const provider = registry.inferFromFilePath(input.file);
      if (!provider) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: `No language provider for: ${input.file}` }),
          }],
          isError: true,
        };
      }

      const typesToQuery = input.symbolTypes ?? ['function', 'class', 'variable', 'import', 'export'];
      const symbols: SymbolInfo[] = [];

      for (const symbolType of typesToQuery) {
        const patternKey = symbolPatternMap[symbolType];
        if (!patternKey) continue;
        const pattern = provider.patterns[patternKey];
        if (!pattern) continue;

        try {
          const result = await queryFile(input.file, pattern);
          for (const match of result.matches) {
            symbols.push({
              name: match.captures['NAME'] || match.text.slice(0, 60),
              type: symbolType,
              range: match.range,
              signature: match.text.length > 100 ? match.text.slice(0, 97) + '...' : match.text,
            });
          }
        } catch {
          // Skip patterns that fail
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            file: input.file,
            language: provider.id,
            symbols,
            symbolCount: symbols.length,
          }, null, 2),
        }],
      };
    },
  );
}
