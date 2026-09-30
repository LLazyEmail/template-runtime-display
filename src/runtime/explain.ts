import { RenderError } from './render';
import type { RenderResult } from './types';

/** One text block for logs. Full HTML stays on each part trace. */
export function explain(result: RenderResult | RenderError): string {
  const thrown = result instanceof RenderError;
  const report = thrown ? fromError(result) : result;
  const lines = [
    thrown
      ? result.message
      : `${report.templateId}: ${report.ok ? 'ok' : 'failed'} (${report.parts.length} parts, ${report.html.length} chars)`,
  ];
  for (const part of report.parts) {
    const detail = part.error ? ` ${part.error.name}: ${part.error.message}` : '';
    lines.push(`  ${part.id} ${part.status} ${part.chars} chars ${part.ms}ms${detail}`);
  }
  if (report.composeError) {
    lines.push(`  compose error ${report.composeError.name}: ${report.composeError.message}`);
  }
  return lines.join('\n');
}

function fromError(error: RenderError): RenderResult {
  return {
    templateId: error.templateId,
    ok: false,
    html: '',
    parts: error.trace,
  };
}
