import type { RenderResult } from '../runtime/types';

/** Gmail clips a message whose HTML is larger than this and hides the rest behind "View entire message". */
export const CLIP_BYTES = 102 * 1024;
/** Where the report starts to warn, so there is room to grow before the clip. */
export const NEAR_BYTES = 80 * 1024;

export type ClipRisk = 'ok' | 'near' | 'over';

export interface PartSize {
  id: string;
  bytes: number;
}

export interface SizeOptions {
  /** Bytes at which a client clips. Default `CLIP_BYTES`. */
  limit?: number;
  /** Bytes at which the report warns. Default `NEAR_BYTES`, never above `limit`. */
  nearLimit?: number;
}

export interface SizeReport {
  /** UTF-8 size of the final document. */
  bytes: number;
  limit: number;
  nearLimit: number;
  clipRisk: ClipRisk;
  /** Parts that produced output, largest first. */
  perPart: readonly PartSize[];
  /** Parts that start after the clip point, so a client hides them. */
  clippedParts: readonly string[];
  /** True when the unsubscribe link sits after the clip point. */
  unsubscribeClipped: boolean;
  warnings: readonly string[];
}

/** UTF-8 length of a string. Counts code points, so no `TextEncoder` or `Buffer` is needed. */
export function byteLength(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) as number;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Measure a render against the size at which Gmail clips. Size is the UTF-8
 * byte length, not `.length`, because that is what the client counts. When the
 * document is over the limit, the report also names the parts that start after
 * the clip point, since those are the ones readers never see.
 */
export function measureSize(result: RenderResult, options: SizeOptions = {}): SizeReport {
  const limit = options.limit ?? CLIP_BYTES;
  const nearLimit = Math.min(options.nearLimit ?? NEAR_BYTES, limit);
  const bytes = byteLength(result.html);
  const clipRisk: ClipRisk = bytes > limit ? 'over' : bytes > nearLimit ? 'near' : 'ok';

  const perPart = result.parts
    .filter((part) => part.html !== '')
    .map((part) => ({ id: part.id, bytes: byteLength(part.html) }))
    .sort((a, b) => b.bytes - a.bytes);

  const clippedParts: string[] = [];
  const warnings: string[] = [];

  if (clipRisk === 'over') {
    for (const part of result.parts) {
      const at = part.html === '' ? -1 : result.html.indexOf(part.html);
      if (at !== -1 && byteLength(result.html.slice(0, at)) >= limit) clippedParts.push(part.id);
    }
    warnings.push(
      `The document is ${kb(bytes)}, over the ${kb(limit)} where Gmail clips it. Readers see "View entire message" instead of the end.`,
    );
    if (clippedParts.length > 0) {
      warnings.push(`Hidden by the clip: ${clippedParts.join(', ')}.`);
    }
  } else if (clipRisk === 'near') {
    warnings.push(
      `The document is ${kb(bytes)}, close to the ${kb(limit)} where Gmail clips it. ${kb(limit - bytes)} left.`,
    );
  }

  const link = result.html.search(/unsubscribe/i);
  const unsubscribeClipped = link !== -1 && byteLength(result.html.slice(0, link)) >= limit;
  if (unsubscribeClipped) {
    warnings.push(
      'The unsubscribe link is after the clip point. Gmail hides it, which hurts deliverability and breaks bulk-sender rules.',
    );
  }

  return { bytes, limit, nearLimit, clipRisk, perPart, clippedParts, unsubscribeClipped, warnings };
}
