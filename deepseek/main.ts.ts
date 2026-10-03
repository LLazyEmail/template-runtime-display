export interface MainProps {
  /** Raw inner HTML of `<main>`. */
  innerHtml?: string;
}

export function main({ innerHtml = '' }: MainProps = {}): string {
  return `<main>
${innerHtml}
  </main>`;
}
