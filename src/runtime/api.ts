import { assertTemplate, type Template as PackageTemplate } from '@llazyemail/render-template';
import type { RenderContext, RenderJob, RenderOptions, RenderResult, Template } from './types';
import { displayErrors } from './errors';
import { renderTemplate } from './renderTemplate';

export { RenderError } from '@llazyemail/render-template';
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

/** Render many templates. Use `onError: 'collect'` so one broken template does not stop the batch. */
export function renderMany<TProps>(
  jobs: readonly RenderJob<TProps>[],
  options?: Pick<RenderOptions<TProps>, 'onError'>,
): RenderResult[] {
  return jobs.map((job) => {
    const next: RenderOptions<TProps> = {};
    if (options?.onError !== undefined) next.onError = options.onError;
    if (job.slots !== undefined) next.slots = job.slots;
    const props = job.props === undefined ? ({} as TProps) : job.props;
    return renderTemplate(job.template, props, next);
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
