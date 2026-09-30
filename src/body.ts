export interface BodyProps {
  /** `<main>` fragment. */
  mainHtml?: string;
  /** `<footer>` fragment. */
  footerHtml?: string;
}

export function body({ mainHtml, footerHtml }: BodyProps = {}): string {
  return `<body>
${mainHtml}
${footerHtml}
</body>`;
}
