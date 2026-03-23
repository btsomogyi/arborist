export function createUnifiedDiff(filePath: string, oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const lines: string[] = [];
  lines.push(`--- a/${filePath}`);
  lines.push(`+++ b/${filePath}`);

  // Simple line-by-line diff
  const maxLen = Math.max(oldLines.length, newLines.length);
  const hunks: Array<{ start: number; oldLines: string[]; newLines: string[] }> = [];
  let currentHunk: { start: number; oldLines: string[]; newLines: string[] } | null = null;

  for (let i = 0; i < maxLen; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined;
    const newLine = i < newLines.length ? newLines[i] : undefined;

    if (oldLine !== newLine) {
      if (!currentHunk) {
        currentHunk = { start: i, oldLines: [], newLines: [] };
      }
      if (oldLine !== undefined) currentHunk.oldLines.push(oldLine);
      if (newLine !== undefined) currentHunk.newLines.push(newLine);
    } else {
      if (currentHunk) {
        hunks.push(currentHunk);
        currentHunk = null;
      }
    }
  }
  if (currentHunk) hunks.push(currentHunk);

  for (const hunk of hunks) {
    const oldStart = hunk.start + 1;
    const newStart = hunk.start + 1;
    lines.push(`@@ -${oldStart},${hunk.oldLines.length} +${newStart},${hunk.newLines.length} @@`);
    for (const l of hunk.oldLines) lines.push(`-${l}`);
    for (const l of hunk.newLines) lines.push(`+${l}`);
  }

  return lines.join('\n');
}
