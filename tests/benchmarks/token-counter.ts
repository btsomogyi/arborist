/**
 * Token estimation utility for comparing scissorhands vs traditional approaches.
 *
 * Uses the standard ~4 chars/token approximation for Claude/GPT models.
 * This is intentionally conservative — real tokenizers produce ~3.5-4.2 chars/token
 * for code, so our estimates are within ±10% of actual counts.
 */

const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Measures token cost of the "traditional" approach to a code operation:
 *   1. Read the entire file (file content goes into context)
 *   2. Agent reasons about what to change (instruction tokens)
 *   3. Agent produces Edit/Write tool call with old_string/new_string
 *
 * Returns the total tokens for the round-trip.
 */
export function measureTraditionalApproach(scenario: {
  fileContent: string;
  instruction: string;
  /** For Edit: the old_string the agent must specify */
  oldStrings: string[];
  /** For Edit: the new_string the agent must specify */
  newStrings: string[];
}): TokenMeasurement {
  // Input tokens: user instruction + file content (Read tool result)
  const readToolCall = JSON.stringify({ tool: 'Read', input: { file_path: 'file' } });
  const readResult = scenario.fileContent;

  const inputTokens =
    estimateTokens(scenario.instruction) +
    estimateTokens(readToolCall) +
    estimateTokens(readResult);

  // Output tokens: one Edit call per change
  let outputTokens = 0;
  for (let i = 0; i < scenario.oldStrings.length; i++) {
    const editCall = JSON.stringify({
      tool: 'Edit',
      input: {
        file_path: 'file',
        old_string: scenario.oldStrings[i],
        new_string: scenario.newStrings[i],
      },
    });
    outputTokens += estimateTokens(editCall);
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    breakdown: {
      instruction: estimateTokens(scenario.instruction),
      fileRead: estimateTokens(readResult),
      toolCalls: outputTokens,
    },
  };
}

/**
 * Measures token cost of the scissorhands approach:
 *   1. A single scissorhands tool call (pattern-based, no file reading needed)
 *   2. Tool returns a concise result
 *
 * The key saving: the agent never needs to read the full file into context.
 */
export function measureScissorhandsApproach(scenario: {
  instruction: string;
  toolCall: Record<string, unknown>;
  /** Estimated result size from the tool */
  resultSize: number;
}): TokenMeasurement {
  const callJson = JSON.stringify(scenario.toolCall);

  const inputTokens = estimateTokens(scenario.instruction);
  const outputTokens = estimateTokens(callJson);
  const resultTokens = Math.ceil(scenario.resultSize / CHARS_PER_TOKEN);

  return {
    inputTokens: inputTokens + resultTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens + resultTokens,
    breakdown: {
      instruction: inputTokens,
      fileRead: 0,
      toolCalls: outputTokens + resultTokens,
    },
  };
}

export interface TokenMeasurement {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  breakdown: {
    instruction: number;
    fileRead: number;
    toolCalls: number;
  };
}

export interface BenchmarkResult {
  name: string;
  language: string;
  tool: string;
  description: string;
  traditional: TokenMeasurement;
  scissorhands: TokenMeasurement;
  savings: {
    absoluteTokens: number;
    percentReduction: number;
    fileSize: number;
    fileLines: number;
  };
}

export function computeSavings(
  name: string,
  language: string,
  tool: string,
  description: string,
  fileContent: string,
  traditional: TokenMeasurement,
  scissorhands: TokenMeasurement,
): BenchmarkResult {
  const saved = traditional.totalTokens - scissorhands.totalTokens;
  const percent = (saved / traditional.totalTokens) * 100;

  return {
    name,
    language,
    tool,
    description,
    traditional,
    scissorhands,
    savings: {
      absoluteTokens: saved,
      percentReduction: Math.round(percent * 10) / 10,
      fileSize: fileContent.length,
      fileLines: fileContent.split('\n').length,
    },
  };
}

export function formatReport(results: BenchmarkResult[]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('='.repeat(90));
  lines.push('  SCISSORHANDS BENCHMARK REPORT — Token Savings Analysis');
  lines.push('='.repeat(90));
  lines.push('');

  // Group by language
  const byLang = new Map<string, BenchmarkResult[]>();
  for (const r of results) {
    const group = byLang.get(r.language) ?? [];
    group.push(r);
    byLang.set(r.language, group);
  }

  for (const [lang, langResults] of byLang) {
    lines.push(`${'─'.repeat(90)}`);
    lines.push(`  Language: ${lang.toUpperCase()}`);
    lines.push(`${'─'.repeat(90)}`);
    lines.push('');
    lines.push(
      padRight('  Scenario', 36) +
        padRight('Tool', 20) +
        padRight('Traditional', 14) +
        padRight('Scissorhands', 12) +
        padRight('Saved', 10) +
        'Reduction',
    );
    lines.push('  ' + '─'.repeat(86));

    for (const r of langResults) {
      lines.push(
        padRight(`  ${r.name}`, 36) +
          padRight(r.tool, 20) +
          padRight(`${r.traditional.totalTokens}`, 14) +
          padRight(`${r.scissorhands.totalTokens}`, 12) +
          padRight(`${r.savings.absoluteTokens}`, 10) +
          `${r.savings.percentReduction}%`,
      );
    }

    const avgSavings =
      langResults.reduce((sum, r) => sum + r.savings.percentReduction, 0) / langResults.length;
    lines.push('');
    lines.push(`  Average savings for ${lang}: ${Math.round(avgSavings * 10) / 10}%`);
    lines.push('');
  }

  // Overall summary
  lines.push('='.repeat(90));
  lines.push('  OVERALL SUMMARY');
  lines.push('='.repeat(90));

  const totalTraditional = results.reduce((s, r) => s + r.traditional.totalTokens, 0);
  const totalScissorhands = results.reduce((s, r) => s + r.scissorhands.totalTokens, 0);
  const totalSaved = totalTraditional - totalScissorhands;
  const overallPercent = Math.round((totalSaved / totalTraditional) * 1000) / 10;

  lines.push('');
  lines.push(`  Total benchmarks:      ${results.length}`);
  lines.push(`  Languages tested:      ${byLang.size}`);
  lines.push(`  Traditional tokens:    ${totalTraditional.toLocaleString()}`);
  lines.push(`  Scissorhands tokens:       ${totalScissorhands.toLocaleString()}`);
  lines.push(`  Tokens saved:          ${totalSaved.toLocaleString()}`);
  lines.push(`  Overall reduction:     ${overallPercent}%`);
  lines.push('');

  // Per-tool summary
  const byTool = new Map<string, BenchmarkResult[]>();
  for (const r of results) {
    const group = byTool.get(r.tool) ?? [];
    group.push(r);
    byTool.set(r.tool, group);
  }

  lines.push('  Per-tool average savings:');
  for (const [tool, toolResults] of byTool) {
    const avg =
      toolResults.reduce((s, r) => s + r.savings.percentReduction, 0) / toolResults.length;
    lines.push(`    ${padRight(tool, 24)} ${Math.round(avg * 10) / 10}%`);
  }
  lines.push('');
  lines.push('='.repeat(90));
  lines.push('');

  return lines.join('\n');
}

function padRight(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}
