import { RenderError } from '@llazyemail/render-template';
import { byteLength, measureSize } from '../quality/size';
import { fromError } from '../runtime/result';
import type { PartFailure, PartStatus, RenderResult } from '../runtime/types';

export interface TraceJsonOptions {
  /** Include each part's HTML and the final document. Default false, so the file stays small. */
  html?: boolean;
}

/** One part in the JSON trace. */
export interface TraceJsonPart {
  id: string;
  status: PartStatus;
  chars: number;
  bytes: number;
  ms: number;
  error?: PartFailure;
  html?: string;
}

/** The shape `traceJson` returns. Stable, so scripts and CI can depend on it. */
export interface TraceJson {
  templateId: string;
  ok: boolean;
  /** Set when the render threw, and names the part that threw. */
  threw?: { partId: string; message: string };
  composeError?: PartFailure;
  size: {
    bytes: number;
    limit: number;
    clipRisk: 'ok' | 'near' | 'over';
    warnings: readonly string[];
  };
  parts: readonly TraceJsonPart[];
  html?: string;
}

/**
 * A render as plain data: status, size and timing per part, errors, and the
 * Gmail size check. Accepts a result or a thrown `RenderError`. Pass
 * `{ html: true }` to include the markup.
 */
export function traceJson(
  input: RenderResult | RenderError,
  options: TraceJsonOptions = {},
): TraceJson {
  const result = input instanceof RenderError ? fromError(input) : input;
  const size = measureSize(result);

  return {
    templateId: result.templateId,
    ok: result.ok,
    ...(input instanceof RenderError
      ? { threw: { partId: input.partId, message: input.message } }
      : {}),
    ...(result.composeError ? { composeError: result.composeError } : {}),
    size: {
      bytes: size.bytes,
      limit: size.limit,
      clipRisk: size.clipRisk,
      warnings: size.warnings,
    },
    parts: result.parts.map((part) => ({
      id: part.id,
      status: part.status,
      chars: part.chars,
      bytes: byteLength(part.html),
      ms: part.ms,
      ...(part.error ? { error: part.error } : {}),
      ...(options.html ? { html: part.html } : {}),
    })),
    ...(options.html ? { html: result.html } : {}),
  };
}

/** `traceJson` as pretty-printed JSON text with a trailing newline. */
export function traceJsonText(
  input: RenderResult | RenderError,
  options: TraceJsonOptions = {},
): string {
  return `${JSON.stringify(traceJson(input, options), null, 2)}\n`;
}
