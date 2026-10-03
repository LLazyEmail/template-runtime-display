export interface HeadProps {
  /** Text for `<title>`. Empty when omitted. */
  title?: string;
  /** Inbox preview text. Rendered as a hidden span at the top of `<head>`. */
  preview?: string;
  /** Raw CSS injected into a `<style>` block. Empty when omitted. */
  styles?: string;
  /** Raw HTML inserted verbatim at the end of `<head>`. Use for MSO comments, extra meta, etc. */
  extraHead?: string;
}

export function head({ title, preview, styles, extraHead }: HeadProps = {}): string {
  const previewHtml = preview ? `<span class="preheader">${preview}</span>` : '';
  const stylesHtml = styles
    ? `<style type="text/css" rel="stylesheet" media="all">${styles}\n    </style>`
    : '';
  return `<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${title ?? ''}</title>
    ${previewHtml}
    ${stylesHtml}
    ${extraHead ?? ''}
  </head>`;
}
