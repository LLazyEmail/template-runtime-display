import type { TemplatePart } from '../../runtime/types';

/** Flat props for the built-in email shell. Every field is optional. */
export interface EmailProps {
  title?: string;
  preview?: string;
  heading?: string;
  bodyText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  companyName?: string;
  unsubscribeUrl?: string;
}

/**
 * An email-shaped template. `parts` are custom steps inserted inside `<body>`
 * after `main` and before `footer`. Built-in `head`, `main`, and `footer`
 * stay in place. A slot with the same id replaces that built-in part.
 */
export interface EmailTemplate {
  id: string;
  parts?: readonly TemplatePart<EmailProps>[];
}
