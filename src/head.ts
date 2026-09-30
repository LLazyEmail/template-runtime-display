export interface HeadProps {
  /** Text for `<title>`. Empty when omitted. */
  title?: string;
  /** Inbox preview text. Rendered as a hidden div inside `<head>`. */
  preview?: string;
}

export function head({ title, preview }: HeadProps = {}): string {
  return `
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title || ''}</title>
    <!-- preview text, hidden -->
    <div style="display:none;max-height:0;overflow:hidden;">${preview || ''}</div>
  </head>`;
}
