import { explain } from '../runtime/explain';
import { inspect } from '../inspect/inspect';
import { failingFindings, findingsFor, summarizeFindings } from '../inspect/findings';
import type { FailLevel } from '../inspect/findings';
import { traceJsonText } from '../inspect/json';
import type { Outcome } from './outcome';
import { crashPage, toInspectable } from './pages';

export interface InspectDeps {
  render: (file: string) => Promise<Outcome>;
  write: (file: string, contents: string) => Promise<void>;
  log: (line: string) => void;
}

/**
 * Render once, write the report, print the trace. The exit code is 0 when
 * every part rendered, 1 when a part broke, and 2 when the module could not
 * be rendered at all. Even then a report is written, so CI can attach it. With
 * `jsonOut`, the trace is also written as JSON (a crash writes `ok: false` and
 * the crash message, so a script can always read the file). With `failOn`, a
 * render whose parts all worked still exits 1 when an email check finds that
 * severity or worse.
 */
export async function inspectCommand(
  file: string,
  out: string,
  deps: InspectDeps,
  jsonOut?: string,
  failOn?: FailLevel,
): Promise<number> {
  const outcome = await deps.render(file);
  const inspectable = toInspectable(outcome);

  if (!inspectable) {
    const crashed = outcome as Extract<Outcome, { kind: 'crash' }>;
    await deps.write(out, crashPage(crashed));
    if (jsonOut) await deps.write(jsonOut, crashJsonText(crashed));
    deps.log(`Could not render ${file}: ${crashed.message}`);
    if (crashed.detail) deps.log(crashed.detail);
    deps.log(`Report written to ${out}`);
    return 2;
  }

  await deps.write(out, inspect(inspectable));
  if (jsonOut) await deps.write(jsonOut, traceJsonText(inspectable));
  deps.log(explain(inspectable));
  deps.log(`Report written to ${out}`);
  if (outcome.kind !== 'result' || !outcome.result.ok) return 1;

  const findings = findingsFor(outcome.result);
  deps.log(`Email checks: ${summarizeFindings(findings)}`);
  if (failOn && failingFindings(findings, failOn).length > 0) {
    deps.log(`Failing because of --fail-on ${failOn}.`);
    return 1;
  }
  return 0;
}

/** What `--json` writes when there was no render to describe. */
export function crashJsonText(crashed: Extract<Outcome, { kind: 'crash' }>): string {
  const { message, detail } = crashed;
  return `${JSON.stringify({ ok: false, crash: { message, ...(detail ? { detail } : {}) } }, null, 2)}\n`;
}
