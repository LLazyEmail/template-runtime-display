import { body } from '../body/body';
import type { BodyProps } from '../body/body';
import { openTag } from '../../utils/openTag';

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
   * Additional raw attributes for the `<html>` element
   * (for example `xmlns="http://www.w3.org/1999/xhtml"`).
   * Placed after `lang` when both are present. Callers own escaping.
   */
  htmlAttributes?: string;
  /**
   * Additional raw attributes for the `<body>` element
   * (for example `style="margin:0;padding:0"` or `class="email"`).
   * Callers own escaping.
   */
  bodyAttributes?: string;
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
  htmlAttributes = '',
  bodyAttributes = '',
  ...rest
}: DocumentProps = {}): string {
  const langPart = lang === false || lang === null || lang === '' ? '' : `lang="${lang}"`;

  const htmlAttrParts = [langPart, htmlAttributes.trim()].filter(Boolean);
  const htmlAttrs = htmlAttrParts.join(' ');

  const htmlOpen = openTag('html', htmlAttrs);
  const bodyHtml = body({ ...rest, attributes: bodyAttributes });

  return `${doctype}
${htmlOpen}
${headHtml}
${bodyHtml}
</html>`;
}
