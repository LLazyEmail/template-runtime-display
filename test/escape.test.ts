import { describe, expect, it } from 'vitest';
import { body } from '../src/templates/body/body';
import { head } from '../src/templates/head/head';
import { main } from '../src/templates/main/main';
import { escapeHtml } from '../src/utils/escape';

describe('escapeHtml', () => {
  it('escapes text and attribute characters', () => {
    expect(escapeHtml(`Tom & Jerry <script> "quote" 'tick'`)).toBe(
      'Tom &amp; Jerry &lt;script&gt; &quot;quote&quot; &#39;tick&#39;',
    );
  });

  it('leaves safe text unchanged', () => {
    expect(escapeHtml('Weekly update')).toBe('Weekly update');
    expect(escapeHtml('')).toBe('');
  });

  it('escapes ampersands before other entities', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});

describe('head updated shell', () => {
  it('renders inbox meta, a preheader span, styles, and extra head html', () => {
    const html = head({
      title: 'Hi',
      preview: 'peek',
      styles: 'body{margin:0}',
      extraHead: '<!--[if mso]><xml></xml><![endif]-->',
    });
    expect(html).toContain('name="x-apple-disable-message-reformatting"');
    expect(html).toContain('name="color-scheme" content="light dark"');
    expect(html).toContain('<title>Hi</title>');
    expect(html).toContain('<span class="preheader">peek</span>');
    expect(html).toContain('<style type="text/css" rel="stylesheet" media="all">body{margin:0}');
    expect(html).toContain('<!--[if mso]><xml></xml><![endif]-->');
  });

  it('omits preview, styles, and extra head when they are absent', () => {
    const html = head({ title: 'Only' });
    expect(html).not.toContain('preheader');
    expect(html).not.toContain('<style');
    expect(html).toContain('<title>Only</title>');
  });
});

describe('body preheader', () => {
  it('places preheader html before main and footer', () => {
    const html = body({
      preheaderHtml: '<span class="preheader">peek</span>',
      mainHtml: '<main></main>',
      footerHtml: '<footer></footer>',
    });
    expect(html.indexOf('preheader')).toBeLessThan(html.indexOf('<main>'));
    expect(html.indexOf('<main>')).toBeLessThan(html.indexOf('<footer>'));
  });
});

describe('main innerHtml', () => {
  it('renders raw inner html and skips structured fields', () => {
    const html = main({
      innerHtml: '<p>Raw</p>',
      heading: 'Ignored',
      ctaLabel: 'Go',
      ctaUrl: 'https://x',
    });
    expect(html).toBe(`<main>\n<p>Raw</p>\n  </main>`);
    expect(html).not.toContain('Ignored');
    expect(html).not.toContain('<a href=');
  });

  it('still renders the structured shell when innerHtml is omitted', () => {
    expect(main({ heading: 'H', bodyText: 'B' })).toContain('<h1>H</h1>');
  });
});
