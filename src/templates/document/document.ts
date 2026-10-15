import { body } from '../body/body';
import type { BodyProps } from '../body/body';
import { openTag, serializeAttributes } from '../../utils/openTag';
import type { TagAttributes } from '../../utils/openTag';

/**
 * Options that control the outer document shell.
 * Defaults preserve the original HTML5 + `lang="en"` behaviour.
 */
export interface DocumentShellOptions {
  /**
   * Full doctype declaration.
   * @default `<!DOCTYPE html>`
   */
  doctype?: string;
  /**
   * Value for the `lang` attribute on `<html>`.
   * Pass `false` or `null` to omit the attribute entirely.
   * @default `"en"`
   */
  lang?: string | false | null;
  /**
   * Additional attributes for the `<html>` element.
   * Accepts a raw string or a structured map
   * (for example `{ xmlns: 'http://www.w3.org/1999/xhtml' }`).
   * Placed after `lang` when both are present. Callers own escaping.
   */
  htmlAttributes?: TagAttributes;
  /**
   * Additional attributes for the `<body>` element.
   * Accepts a raw string or a structured map
   * (for example `{ style: 'margin:0;padding:0' }`).
   * Callers own escaping.
   */
  bodyAttributes?: TagAttributes;
}

export interface DocumentProps extends BodyProps, DocumentShellOptions {
  /** `<head>` fragment, placed directly after the opening `<html>` tag. */
  headHtml?: string;
}

/**
 * Full HTML document.
 *
 * Defaults to HTML5 (`<!DOCTYPE html>`) with `<html lang="en">` and a plain `<body>`.
 * Use the shell options to support XHTML transitional, custom body styles,
 * or documents that omit `lang`.
 *
 * Omitted fragments render as empty strings. Output never contains the word `undefined`.
 */
export function document({
  headHtml = '',
  doctype = '<!DOCTYPE html>',
  lang = 'en',
  htmlAttributes,
  bodyAttributes,
  ...rest
}: DocumentProps = {}): string {
  const langPart = lang === false || lang === null || lang === '' ? '' : `lang="${lang}"`;

  const htmlAttrParts = [langPart, serializeAttributes(htmlAttributes)].filter(Boolean);
  const htmlAttrs = htmlAttrParts.join(' ');

  const htmlOpen = openTag('html', htmlAttrs);
  const bodyHtml = body({
    ...rest,
    ...(bodyAttributes !== undefined ? { attributes: bodyAttributes } : {}),
  });

  return `${doctype}
${htmlOpen}
${headHtml}
${bodyHtml}
</html>`;
}
