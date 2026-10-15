import { openTag } from '../../utils/openTag';
import type { TagAttributes } from '../../utils/openTag';

export interface BodyProps {
  /** Raw HTML for the top of `<body>` (e.g. hidden preheader). */
  preheaderHtml?: string;
  /** `<main>` fragment. */
  mainHtml?: string;
  /** `<footer>` fragment. */
  footerHtml?: string;
  /**
   * Attributes for the opening `<body>` tag.
   * Accepts a raw string or a structured map
   * (for example `{ style: 'background-color:#fff;margin:0' }`).
   * Callers own escaping. Empty when omitted.
   */
  attributes?: TagAttributes;
}

export function body({
  preheaderHtml = '',
  mainHtml = '',
  footerHtml = '',
  attributes,
}: BodyProps = {}): string {
  const open = openTag('body', attributes);
  return `${open}
    ${preheaderHtml}
${mainHtml}
${footerHtml}
  </body>`;
}
