import type { RenderContext } from './types';
import { displayErrors } from './errors';

export { DisplayError, DisplayErrorCode, displayErrors } from './errors';

/** Read a slot. A missing slot is `''`. A function slot is called with the same context. */
export function slot<TProps>(ctx: RenderContext<TProps>, id: string): string {
  if (!hasSlot(ctx, id)) return '';
  const value = ctx.slots[id];
  if (typeof value === 'function') {
    const html = value(ctx);
    if (html == null) return '';
    if (typeof html !== 'string') throw displayErrors.slotReturn(id, html);
    return html;
  }
  if (typeof value === 'string') return value;
  throw displayErrors.slotType(id, value);
}

/** True when the caller passed this slot, including an empty string. */
export function hasSlot<TProps>(ctx: RenderContext<TProps>, id: string): boolean {
  return Object.hasOwn(ctx.slots, id);
}
