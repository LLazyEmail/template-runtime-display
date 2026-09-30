import { writeGeneratedFile } from 'markup-generator';
import { document, footer, head, main } from '../dist/index.js';

const html = document({
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

const outPath = await writeGeneratedFile({
  content: html,
  fileName: 'letter.html',
  dir: 'generated',
});

console.log(outPath);
