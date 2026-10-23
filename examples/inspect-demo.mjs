import { defineEmailTemplate, slot } from '../dist/index.js';

// A letter with one part that breaks, so the inspector has something to show.
//
//   npm run demo
//
// Open the page and the `promo` part is red. Then fix it: set `promoCode`
// below to 'save10', save, and the page reloads with the part green and the
// change listed under "Changes since the previous render".

export const template = defineEmailTemplate({
  id: 'weekly-digest',
  parts: [
    {
      id: 'highlights',
      render: () => '<ul><li>Shipped the inspector</li><li>Fixed three bugs</li></ul>',
    },
    {
      id: 'promo',
      render: (ctx) => `<p>Use code <b>${ctx.props.promoCode.toUpperCase()}</b> for 10% off.</p>`,
    },
    { id: 'note', render: (ctx) => slot(ctx, 'note') },
  ],
});

export const props = {
  title: 'Weekly digest',
  preview: 'Three things that shipped',
  heading: 'Weekly digest',
  bodyText: 'Three things that shipped this week.',
  ctaLabel: 'Read more',
  ctaUrl: 'https://example.com/digest',
  companyName: 'LLazyEmail',
  unsubscribeUrl: 'https://example.com/unsubscribe',
  promoCode: undefined,
};

export const options = {
  slots: { note: '<p>Thanks for reading.</p>' },
};
