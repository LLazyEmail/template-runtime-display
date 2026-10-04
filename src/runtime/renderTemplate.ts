import {
  renderTemplate as renderPackageTemplate,
  type RenderOptions as PackageRenderOptions,
  type RenderResult as PackageRenderResult,
  type Template as PackageTemplate,
} from '@llazyemail/render-template';
import type { RenderOptions, RenderResult, Template } from './types';

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
    options as PackageRenderOptions<TProps>,
  ) as PackageRenderResult as RenderResult;
}
