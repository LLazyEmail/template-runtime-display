export interface MainProps {
  /** `<h1>` text. Ignored when `innerHtml` is set. */
  heading?: string;
  /** Paragraph under the heading. May contain inline HTML. Ignored when `innerHtml` is set. */
  bodyText?: string;
  /** Button label. The button is omitted unless `ctaUrl` is set too. */
  ctaLabel?: string;
  /** Button href. The button is omitted unless `ctaLabel` is set too. */
  ctaUrl?: string;
  /** Raw inner HTML of `<main>`. When set, structured fields are not rendered. */
  innerHtml?: string;
}

export function main({ heading, bodyText, ctaLabel, ctaUrl, innerHtml }: MainProps = {}): string {
  if (innerHtml !== undefined) {
    return `<main>\n${innerHtml}\n  </main>`;
  }

  const cta =
    ctaLabel && ctaUrl
      ? `<a href="${ctaUrl}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:4px;">${ctaLabel}</a>`
      : '';

  return `
    <main>
      <h1>${heading || ''}</h1>
      <p>${bodyText || ''}</p>
      ${cta}
    </main>`;
}
