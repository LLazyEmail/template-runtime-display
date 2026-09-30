export interface MainProps {
  /** `<h1>` text. */
  heading?: string;
  /** Paragraph under the heading. May contain inline HTML. */
  bodyText?: string;
  /** Button label. The button is omitted unless `ctaUrl` is set too. */
  ctaLabel?: string;
  /** Button href. The button is omitted unless `ctaLabel` is set too. */
  ctaUrl?: string;
}

export function main({ heading, bodyText, ctaLabel, ctaUrl }: MainProps = {}): string {
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
