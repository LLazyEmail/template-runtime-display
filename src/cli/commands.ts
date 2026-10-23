import { explain } from '../runtime/explain';
import { inspect } from '../inspect/inspect';
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
 * be rendered at all. Even then a report is written, so CI can attach it.
 */
export async function inspectCommand(
  file: string,
  out: string,
  deps: InspectDeps,
): Promise<number> {
  const outcome = await deps.render(file);
  const inspectable = toInspectable(outcome);

  if (!inspectable) {
    const crashed = outcome as Extract<Outcome, { kind: 'crash' }>;
    await deps.write(out, crashPage(crashed));
    deps.log(`Could not render ${file}: ${crashed.message}`);
    if (crashed.detail) deps.log(crashed.detail);
    deps.log(`Report written to ${out}`);
    return 2;
  }

  await deps.write(out, inspect(inspectable));
  deps.log(explain(inspectable));
  deps.log(`Report written to ${out}`);
  return outcome.kind === 'result' && outcome.result.ok ? 0 : 1;
}
