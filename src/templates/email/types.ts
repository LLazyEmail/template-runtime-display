import type { TemplatePart } from '../../runtime/types';
import type { DocumentShellOptions } from '../document';

/** Flat props for the built-in email shell. Every field is optional. */
export interface EmailProps extends DocumentShellOptions {
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
 *
 * `shell` holds default document options for this template. Per-render
 * `EmailProps` override them.
 */
export interface EmailTemplate {
  id: string;
  parts?: readonly TemplatePart<EmailProps>[];
  shell?: DocumentShellOptions;
}
