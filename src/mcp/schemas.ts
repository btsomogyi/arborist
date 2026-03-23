import { z } from 'zod';

export const parseInputSchema = z.object({
  file: z.string().describe('Path to the source file'),
  depth: z.number().optional().default(10).describe('Max AST depth'),
  nodeTypes: z.array(z.string()).optional().describe('Filter to node types'),
});

export const queryInputSchema = z.object({
  file: z.string().describe('Path to the source file'),
  pattern: z.string().describe('ast-grep structural pattern'),
  language: z.string().optional().describe('Override language detection'),
});

export const editInputSchema = z.object({
  file: z.string().describe('Path to the source file'),
  operation: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('replace'),
      pattern: z.string().describe('Pattern to find'),
      replacement: z.string().describe('Replacement template with $CAPTURES'),
      matchIndex: z.number().optional().describe('Only replace the Nth match'),
      scope: z.string().optional().describe('Restrict to scope matching pattern'),
    }),
    z.object({
      kind: z.literal('rename'),
      from: z.string().describe('Identifier to rename'),
      to: z.string().describe('New name'),
      scope: z.string().optional().describe('Restrict to scope matching pattern'),
    }),
    z.object({
      kind: z.literal('insert'),
      anchor: z.string().describe('Pattern to find the anchor node'),
      position: z.enum(['before', 'after', 'prepend', 'append']).describe('Where to insert relative to anchor'),
      content: z.string().describe('Content to insert'),
    }),
    z.object({
      kind: z.literal('remove'),
      pattern: z.string().describe('Pattern matching nodes to remove'),
      matchIndex: z.number().optional().describe('Only remove the Nth match'),
    }),
  ]).describe('The edit operation to perform'),
  dryRun: z.boolean().optional().default(false).describe('Preview changes without writing'),
});

export const batchInputSchema = z.object({
  edits: z.array(z.object({
    file: z.string().describe('Path to the source file'),
    operation: editInputSchema.shape.operation,
  })).describe('Array of edits to apply atomically'),
  dryRun: z.boolean().optional().default(false).describe('Preview changes without writing'),
});

export const listSymbolsInputSchema = z.object({
  file: z.string().describe('Path to the source file'),
  symbolTypes: z.array(
    z.enum(['function', 'class', 'variable', 'import', 'export', 'type'])
  ).optional().describe('Filter to specific symbol types'),
});

export const renameInputSchema = z.object({
  file: z.string().describe('Path to the source file'),
  from: z.string().describe('Identifier to rename'),
  to: z.string().describe('New name'),
  scope: z.string().optional().describe('Restrict to scope matching pattern'),
  dryRun: z.boolean().optional().default(false).describe('Preview changes without writing'),
});

// Type exports for use in tool handlers
export type ParseInput = z.infer<typeof parseInputSchema>;
export type QueryInput = z.infer<typeof queryInputSchema>;
export type EditInput = z.infer<typeof editInputSchema>;
export type BatchInput = z.infer<typeof batchInputSchema>;
export type ListSymbolsInput = z.infer<typeof listSymbolsInputSchema>;
export type RenameInput = z.infer<typeof renameInputSchema>;
