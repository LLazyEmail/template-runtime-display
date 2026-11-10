import { lintEmail } from '../quality/lint';
import type { Finding, Severity } from '../quality/lint';
import type { RenderResult } from '../runtime/types';

/** The lowest severity that fails a run. `info` never fails one. */
export type FailLevel = 'error' | 'warn';

const RANK: Readonly<Record<Severity, number>> = { error: 2, warn: 1, info: 0 };
const LABELS: readonly (readonly [Severity, string, string])[] = [
  ['error', 'error', 'errors'],
  ['warn', 'warning', 'warnings'],
  ['info', 'note', 'notes'],
];

/**
 * The findings for a render. A result with no document has nothing to lint,
 * and linting an empty string would only report that everything is missing.
 */
export function findingsFor(result: RenderResult): readonly Finding[] {
  return result.html === '' ? [] : lintEmail(result);
}

/** Most severe first. The order within a severity is kept. */
export function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort((a, b) => RANK[b.severity] - RANK[a.severity]);
}

/** The findings at or above `level`. */
export function failingFindings(findings: readonly Finding[], level: FailLevel): Finding[] {
  return findings.filter((finding) => RANK[finding.severity] >= RANK[level]);
}

/** `1 error, 2 warnings`, or `no findings`. */
export function summarizeFindings(findings: readonly Finding[]): string {
  const parts = LABELS.flatMap(([severity, one, many]) => {
    const count = findings.filter((finding) => finding.severity === severity).length;
    return count === 0 ? [] : [`${count} ${count === 1 ? one : many}`];
  });
  return parts.length === 0 ? 'no findings' : parts.join(', ');
}
