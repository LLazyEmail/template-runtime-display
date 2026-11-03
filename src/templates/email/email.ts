import type { RenderOptions } from '@llazyemail/render-template';
import { qualityReport, type QualityReport } from '../../quality/report';
import { footer } from '../footer/footer';
import { head } from '../head/head';
import { main } from '../main/main';
import { defineTemplate, renderTemplate } from '../../runtime/render';
import type { RenderResult, Template } from '../../runtime/types';
import { pickDefined } from '../../utils/pickDefined';
import { composeEmail, shellPart } from './shell';
import type { EmailProps, EmailTemplate } from './types';

export type { EmailProps, EmailTemplate } from './types';

/** Build a `Template<EmailProps>` from the email shell plus custom parts. */
export function defineEmailTemplate(input: EmailTemplate): Template<EmailProps> {
  const extras = input.parts ?? [];
  return defineTemplate({
    id: input.id,
    parts: [
      shellPart('head', (ctx) =>
        head(pickDefined({ title: ctx.props.title, preview: ctx.props.preview })),
      ),
      shellPart('main', (ctx) =>
        main(
          pickDefined({
            heading: ctx.props.heading,
            bodyText: ctx.props.bodyText,
            ctaLabel: ctx.props.ctaLabel,
            ctaUrl: ctx.props.ctaUrl,
          }),
        ),
      ),
      ...extras,
      shellPart('footer', (ctx) =>
        footer(
          pickDefined({
            companyName: ctx.props.companyName,
            unsubscribeUrl: ctx.props.unsubscribeUrl,
          }),
        ),
      ),
    ],
    compose: (parts, ctx) => composeEmail(parts, ctx.props, input.shell),
  });
}

export interface EmailRenderOptions extends RenderOptions<EmailProps> {
  /** When true, attach a `quality` report (findings, size, plain text). Default output stays identical. */
  check?: boolean;
}

export interface EmailRenderResult extends RenderResult {
  quality?: QualityReport;
}

/** Render an email template input, or a template already built with `defineEmailTemplate`. */
export function renderEmail(
  template: EmailTemplate | Template<EmailProps>,
  props: EmailProps = {},
  options?: EmailRenderOptions,
): EmailRenderResult {
  const defined = isTemplate(template) ? template : defineEmailTemplate(template);
  const result = renderTemplate(defined, props, options);
  if (options?.check) {
    return { ...result, quality: qualityReport(result) };
  }
  return result;
}

function isTemplate(value: EmailTemplate | Template<EmailProps>): value is Template<EmailProps> {
  return 'compose' in value && typeof value.compose === 'function';
}
