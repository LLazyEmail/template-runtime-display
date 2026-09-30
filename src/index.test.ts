import { describe, expect, it } from 'vitest';
import { body, content, document, footer, head, main } from './index';

describe('head', () => {
  it('renders an empty title by default', () => {
    const html = head();
    expect(html).toContain('<head>');
    expect(html).toContain('</head>');
    expect(html).toContain('<title></title>');
  });

  it('interpolates title and preview', () => {
    const html = head({ title: 'Hi', preview: 'peek' });
    expect(html).toContain('<title>Hi</title>');
    expect(html).toContain('>peek</div>');
  });
});

describe('main', () => {
  it('omits the button unless both label and url are set', () => {
    expect(main({ heading: 'H', bodyText: 'B' })).not.toContain('<a href=');
    expect(main({ heading: 'H', ctaLabel: 'Go' })).not.toContain('<a href=');
    expect(main({ heading: 'H', ctaUrl: 'https://x' })).not.toContain('<a href=');
  });

  it('renders the button when both label and url are set', () => {
    const html = main({ ctaLabel: 'Go', ctaUrl: 'https://x' });
    expect(html).toContain('href="https://x"');
    expect(html).toContain('>Go</a>');
  });
});

describe('footer', () => {
  it('omits unsubscribe when no url is given', () => {
    const html = footer({ companyName: 'Acme' });
    expect(html).toContain('Acme');
    expect(html).not.toContain('Unsubscribe');
  });

  it('renders unsubscribe when a url is given', () => {
    const html = footer({ unsubscribeUrl: 'https://x/u' });
    expect(html).toContain('href="https://x/u"');
    expect(html).toContain('Unsubscribe');
  });
});

describe('document', () => {
  it('wraps head, main, and footer in an html document', () => {
    const html = document({
      headHtml: '<head></head>',
      mainHtml: '<main></main>',
      footerHtml: '<footer></footer>',
    });
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<head></head>');
    expect(html).toContain(body({ mainHtml: '<main></main>', footerHtml: '<footer></footer>' }));
    expect(html).toContain('</html>');
  });

  it('is deterministic', () => {
    const a = document({ mainHtml: '<main></main>' });
    const b = document({ mainHtml: '<main></main>' });
    expect(a).toBe(b);
  });

  it('renders a shell when no fragments are passed', () => {
    const html = document();
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<body>');
    expect(html).toContain('</html>');
  });
});

describe('content', () => {
  it('renders an empty wrapper by default', () => {
    const html = content();
    expect(html).toContain('<div>');
    expect(html).toContain('</div>');
  });

  it('inserts the supplied HTML', () => {
    expect(content({ content: '<p>Hello</p>' })).toContain('<p>Hello</p>');
  });
});
