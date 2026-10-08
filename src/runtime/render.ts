import {
  assertTemplate,
  renderMany,
  renderTemplate as renderPackageTemplate,
  type RenderOptions,
  type RenderResult as PackageRenderResult,
  type Template as PackageTemplate,
} from '@llazyemail/render-template';
import type { RenderResult, Template } from './types';

export { renderMany };

export { hasSlot, slot, DisplayError, DisplayErrorCode, displayErrors } from './api';

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

/**
 * Render one template. The same template and props produce the same HTML.
 * The runtime keeps no state between calls.
 */
export function renderTemplate<TProps>(
  template: Template<TProps>,
  props: TProps,
  options: RenderOptions<TProps> = {},
): RenderResult {
  return renderPackageTemplate(
    template as PackageTemplate<TProps>,
    props,
    options,
  ) as PackageRenderResult as RenderResult;
}
