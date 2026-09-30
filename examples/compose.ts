import { document, footer, head, main } from '../src/index';

/** Sample letter. Shows the composition order; it is not a package export. */
export const sampleHtml = document({
  headHtml: head({ title: 'Weekly update', preview: 'Three things that shipped' }),
  mainHtml: main({
    heading: 'Weekly update',
    bodyText: 'Three things that shipped.',
    ctaLabel: 'Read',
    ctaUrl: 'https://example.com/update',
  }),
  footerHtml: footer({
    companyName: 'LLazyEmail',
    unsubscribeUrl: 'https://example.com/unsubscribe',
  }),
});
