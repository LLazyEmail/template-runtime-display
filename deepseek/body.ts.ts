export interface BodyProps {
  /** Raw HTML for the top of `<body>` (e.g. hidden preheader). */
  preheaderHtml?: string;
  /** `<main>` fragment. */
  mainHtml?: string;
  /** `<footer>` fragment. */
  footerHtml?: string;
}

export function body({
  preheaderHtml = '',
  mainHtml = '',
  footerHtml = '',
}: BodyProps = {}): string {
  return `<body>
    ${preheaderHtml}
${mainHtml}
${footerHtml}
  </body>`;
}
