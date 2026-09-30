import { describe, expect, it } from 'vitest';
import { document, footer, head, main } from './index';
import { defineEmailTemplate, renderEmail } from './index';
import { slot } from './index';

const props = {
  title: 'Hi',
  preview: 'peek',
  heading: 'H',
  bodyText: 'B',
  ctaLabel: 'Go',
  ctaUrl: 'https://x',
  companyName: 'Acme',
  unsubscribeUrl: 'https://x/u',
};

describe('renderEmail', () => {
  it('matches the fragment document when no custom parts are passed', () => {
    const viaRuntime = renderEmail({ id: 'letter' }, props).html;
    const viaFragments = document({
      headHtml: head({ title: props.title, preview: props.preview }),
      mainHtml: main({
        heading: props.heading,
        bodyText: props.bodyText,
        ctaLabel: props.ctaLabel,
        ctaUrl: props.ctaUrl,
      }),
      footerHtml: footer({
        companyName: props.companyName,
        unsubscribeUrl: props.unsubscribeUrl,
      }),
    });
    expect(viaRuntime).toBe(viaFragments);
  });

  it('matches an empty fragment shell when props are omitted', () => {
    expect(renderEmail({ id: 'empty' }).html).toBe(
      document({
        headHtml: head(),
        mainHtml: main(),
        footerHtml: footer(),
      }),
    );
  });

  it('places a custom part after main and before footer', () => {
    const html = renderEmail(
      {
        id: 'with-note',
        parts: [{ id: 'note', render: (ctx) => slot(ctx, 'note') }],
      },
      { heading: 'H' },
      { slots: { note: '<section>NOTE</section>' } },
    ).html;
    expect(html.indexOf('<main>')).toBeLessThan(html.indexOf('<section>NOTE</section>'));
    expect(html.indexOf('<section>NOTE</section>')).toBeLessThan(html.indexOf('<footer>'));
  });

  it('lets a slot replace head, main, and footer', () => {
    const html = renderEmail(
      { id: 'replaced' },
      props,
      {
        slots: {
          head: '<head><title>Slot</title></head>',
          main: '<main>CUSTOM</main>',
          footer: '<footer>END</footer>',
        },
      },
    ).html;
    expect(html).toContain('<title>Slot</title>');
    expect(html).toContain('<main>CUSTOM</main>');
    expect(html).toContain('<footer>END</footer>');
    expect(html).not.toContain('<h1>H</h1>');
    expect(html).not.toContain('>Hi</title>');
  });

  it('accepts a template that was already defined', () => {
    const defined = defineEmailTemplate({ id: 'ready' });
    const again = renderEmail(defined, { title: 'Ready' });
    expect(again.templateId).toBe('ready');
    expect(again.html).toContain('<title>Ready</title>');
    expect(again.ok).toBe(true);
  });

  it('rejects a custom part that reuses a shell id', () => {
    expect(() => defineEmailTemplate({ id: 'bad', parts: [{ id: 'main', render: () => '' }] })).toThrow(
      /duplicate part id "main"/,
    );
  });
});
