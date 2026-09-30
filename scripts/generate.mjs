import { writeGeneratedFile } from 'markup-generator';
import { explain, renderEmail, slot } from '../dist/index.js';

const result = renderEmail(
  {
    id: 'weekly',
    parts: [{ id: 'note', render: (ctx) => slot(ctx, 'note') }],
  },
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
  {
    onError: 'collect',
    slots: { note: '<p>Custom note</p>' },
  },
);

console.log(explain(result));

if (!result.ok) {
  process.exit(1);
}

const outPath = await writeGeneratedFile({
  content: result.html,
  fileName: 'letter.html',
  dir: 'generated',
});

console.log(outPath);
