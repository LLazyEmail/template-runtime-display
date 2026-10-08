import { assertTemplate, type Template as PackageTemplate } from '@llazyemail/render-template';
import type { RenderContext, Template } from './types';
import { displayErrors } from './errors';

export { DisplayError, DisplayErrorCode, displayErrors } from './errors';

/**
 * Validate, copy, and freeze a template. Later edits to the caller's part
 * array do not change a template that has already been defined.
 */
export function defineTemplate<TProps>(template: Template<TProps>): Template<TProps> {
  assertTemplate(template as PackageTemplate<TProps>);
  return Object.freeze({
    id: template.id,
    parts: Object.freeze(
      template.parts.map((part) => Object.freeze({ id: part.id, render: part.render })),
    ),
    compose: template.compose,
  });
}

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
