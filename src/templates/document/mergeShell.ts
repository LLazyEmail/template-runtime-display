import type { DocumentShellOptions } from './document';

/**
 * Merge template-level shell defaults with per-render overrides.
 * Defined fields on `overrides` win. Omitted fields keep the default.
 * Explicit `false` / `null` for `lang` is preserved.
 */
export function mergeShell(
  defaults: DocumentShellOptions | undefined,
  overrides: DocumentShellOptions,
): DocumentShellOptions {
  const merged: DocumentShellOptions = { ...defaults };
  if (overrides.doctype !== undefined) merged.doctype = overrides.doctype;
  if (overrides.lang !== undefined) merged.lang = overrides.lang;
  if (overrides.htmlAttributes !== undefined) merged.htmlAttributes = overrides.htmlAttributes;
  if (overrides.bodyAttributes !== undefined) merged.bodyAttributes = overrides.bodyAttributes;
  return merged;
}
