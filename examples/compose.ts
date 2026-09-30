import { defineEmailTemplate, renderEmail, slot } from '../src/index';

/** Sample letter. Shows the runtime plus one custom slot. Not a package export. */
const weekly = defineEmailTemplate({
  id: 'weekly',
  parts: [{ id: 'note', render: (ctx) => slot(ctx, 'note') }],
});

const sample = renderEmail(
  weekly,
  {
    title: 'Weekly update',
    preview: 'Three things that shipped',
    heading: 'Weekly update',
    bodyText: 'Three things that shipped.',
    ctaLabel: 'Read',
    ctaUrl: 'https://example.com/update',
    companyName: 'LLazyEmail',
    unsubscribeUrl: 'https://example.com/unsubscribe',
  },
  { slots: { note: '<p>Custom note</p>' } },
);

export const sampleHtml = sample.html;
