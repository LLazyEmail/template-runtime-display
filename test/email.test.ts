import { describe, expect, it } from 'vitest';
import { document } from '../src/templates/document/document';
import { footer } from '../src/templates/footer/footer';
import { head } from '../src/templates/head/head';
import { main } from '../src/templates/main/main';
import { explain } from '../src/runtime/explain';
import { defineEmailTemplate, renderEmail } from '../src/templates/email/email';
import { slot } from '../src/runtime/render';
import type { EmailTemplate } from '../src/templates/email/email';

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

  it('places custom parts after main and before footer, in order', () => {
    const html = renderEmail(
      {
        id: 'with-note',
        parts: [
          { id: 'note', render: (ctx) => slot(ctx, 'note') },
          { id: 'promo', render: () => '<aside>PROMO</aside>' },
        ],
      },
      { heading: 'H' },
      { slots: { note: (ctx) => `<section>${ctx.templateId}</section>` } },
    ).html;
    const noteAt = html.indexOf('<section>with-note</section>');
    const promoAt = html.indexOf('<aside>PROMO</aside>');
    expect(html.indexOf('<main>')).toBeLessThan(noteAt);
    expect(noteAt).toBeLessThan(promoAt);
    expect(promoAt).toBeLessThan(html.indexOf('<footer>'));
  });

  it('renders an omitted custom slot as an empty part', () => {
    const result = renderEmail({
      id: 'with-note',
      parts: [{ id: 'note', render: (ctx) => slot(ctx, 'note') }],
    });
    expect(result.ok).toBe(true);
    expect(result.html).not.toContain('undefined');
    expect(result.parts.find((part) => part.id === 'note')?.status).toBe('empty');
  });

  it('names a broken custom part and still finishes the shell when collecting', () => {
    const input = {
      id: 'broken-note',
      parts: [
        {
          id: 'note',
          render: () => {
            throw new Error('note broke');
          },
        },
      ],
    };
    expect(() => renderEmail(input)).toThrow(/failed at part "note": note broke/);

    const result = renderEmail(input, {}, { onError: 'collect' });
    expect(result.ok).toBe(false);
    expect(result.html).not.toContain('undefined');
    expect(result.parts.map((part) => [part.id, part.status])).toEqual([
      ['head', 'ok'],
      ['main', 'ok'],
      ['note', 'error'],
      ['footer', 'ok'],
    ]);
    expect(explain(result)).toContain('note broke');
  });

  it('lets a slot replace head, main, and footer', () => {
    const html = renderEmail({ id: 'replaced' }, props, {
      slots: {
        head: '<head><title>Slot</title></head>',
        main: '<main>CUSTOM</main>',
        footer: '<footer>END</footer>',
      },
    }).html;
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
    expect(() =>
      defineEmailTemplate({ id: 'bad', parts: [{ id: 'main', render: () => '' }] }),
    ).toThrow(/duplicate part id "main"/);
  });

  it('treats a non-function compose field as email input', () => {
    const html = renderEmail({ id: 'plain', compose: 1 } as unknown as EmailTemplate).html;
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
  });

  it('names the shell part when compose is called without rendered HTML', () => {
    const defined = defineEmailTemplate({ id: 'letter' });
    expect(() => defined.compose({}, { templateId: 'letter', props: {}, slots: {} })).toThrow(
      /missing part "head"/,
    );
  });
});
