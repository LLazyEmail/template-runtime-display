export interface FooterProps {
  /** Company name in the footer. */
  companyName?: string;
  /** Unsubscribe href. The link is omitted when this is absent. */
  unsubscribeUrl?: string;
}

export function footer({ companyName, unsubscribeUrl }: FooterProps = {}): string {
  const unsubscribe = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}">Unsubscribe</a>`
    : '';

  return `
    <footer>
      <p>${companyName || ''}</p>
      ${unsubscribe}
    </footer>`;
}
