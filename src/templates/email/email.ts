import { document } from '../document/document';
import { footer } from '../footer/footer';
import { head } from '../head/head';
import { main } from '../main/main';
import { defineTemplate, hasSlot, renderTemplate, slot } from '../../runtime/render';
import type { RenderOptions, RenderResult, Template, TemplatePart } from '../../runtime/types';

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

/** Build a `Template<EmailProps>` from the email shell plus custom parts. */
export function defineEmailTemplate(input: EmailTemplate): Template<EmailProps> {
  const extras = input.parts ?? [];
  return defineTemplate({
    id: input.id,
    parts: [
      {
        id: 'head',
        render: (ctx) => {
          if (hasSlot(ctx, 'head')) return slot(ctx, 'head');
          return head(pickDefined({ title: ctx.props.title, preview: ctx.props.preview }));
        },
      },
      {
        id: 'main',
        render: (ctx) => {
          if (hasSlot(ctx, 'main')) return slot(ctx, 'main');
          return main(
            pickDefined({
              heading: ctx.props.heading,
              bodyText: ctx.props.bodyText,
              ctaLabel: ctx.props.ctaLabel,
              ctaUrl: ctx.props.ctaUrl,
            }),
          );
        },
      },
      ...extras,
      {
        id: 'footer',
        render: (ctx) => {
          if (hasSlot(ctx, 'footer')) return slot(ctx, 'footer');
          return footer(
            pickDefined({
              companyName: ctx.props.companyName,
              unsubscribeUrl: ctx.props.unsubscribeUrl,
            }),
          );
        },
      },
    ],
    compose: (parts) => {
      // Read the shell before custom ids. Key order is the part list.
      const headHtml = readPart(parts, 'head');
      const mainPiece = readPart(parts, 'main');
      const extraIds = Object.keys(parts).filter((id) => !SHELL_PARTS.has(id));
      const extraHtml = extraIds.map((id) => readPart(parts, id)).join('\n');
      const footerHtml = readPart(parts, 'footer');
      const mainHtml = extraIds.length > 0 ? `${mainPiece}\n${extraHtml}` : mainPiece;
      return document({ headHtml, mainHtml, footerHtml });
    },
  });
}

/** Render an email template input, or a template already built with `defineEmailTemplate`. */
export function renderEmail(
  template: EmailTemplate | Template<EmailProps>,
  props: EmailProps = {},
  options?: RenderOptions<EmailProps>,
): RenderResult {
  const defined = isTemplate(template) ? template : defineEmailTemplate(template);
  return renderTemplate(defined, props, options);
}

function isTemplate(value: EmailTemplate | Template<EmailProps>): value is Template<EmailProps> {
  return 'compose' in value && typeof value.compose === 'function';
}

const SHELL_PARTS = new Set(['head', 'main', 'footer']);

function readPart(parts: Readonly<Record<string, string>>, id: string): string {
  const html = parts[id];
  if (typeof html !== 'string') {
    throw new TypeError(`email shell is missing part "${id}"`);
  }
  return html;
}

function pickDefined<T extends Record<string, string | undefined>>(
  values: T,
): {
  [K in keyof T]?: string;
} {
  const picked: { [K in keyof T]?: string } = {};
  for (const key of Object.keys(values) as (keyof T)[]) {
    const value = values[key];
    if (typeof value === 'string') picked[key] = value;
  }
  return picked;
}
