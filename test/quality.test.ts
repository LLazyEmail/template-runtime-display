import { describe, expect, it } from 'vitest';
import { defineEmailTemplate, renderEmail } from '../src/index';
import type { PartTrace, RenderResult } from '../src/index';
import { CLIP_BYTES, NEAR_BYTES, byteLength, measureSize } from '../src/quality/size';
import { toText } from '../src/quality/text';

function part(id: string, html: string): PartTrace {
  return { id, status: 'ok', html, chars: html.length, ms: 0 };
}

function result(parts: PartTrace[], html?: string): RenderResult {
  return { templateId: 'demo', ok: true, html: html ?? parts.map((p) => p.html).join(''), parts };
}

describe('byteLength', () => {
  it('counts UTF-8 bytes for one, two, three and four byte characters', () => {
    expect(byteLength('')).toBe(0);
    expect(byteLength('a')).toBe(1);
    expect(byteLength('é')).toBe(2);
    expect(byteLength('€')).toBe(3);
    expect(byteLength('😀')).toBe(4);
    expect(byteLength('a€😀')).toBe(8);
  });

  it('puts every encoding boundary on the right side', () => {
    expect(byteLength('\u007f')).toBe(1);
    expect(byteLength('\u0080')).toBe(2);
    expect(byteLength('Ж')).toBe(2);
    expect(byteLength('\u07ff')).toBe(2);
    expect(byteLength('\u0800')).toBe(3);
    expect(byteLength('\uffff')).toBe(3);
    expect(byteLength('\u{10000}')).toBe(4);
    expect(byteLength('\u{10ffff}')).toBe(4);
  });

  it('is larger than .length for non-ASCII text', () => {
    expect('€€€'.length).toBe(3);
    expect(byteLength('€€€')).toBe(9);
  });
});

describe('measureSize', () => {
  it('exposes the Gmail limits', () => {
    expect(CLIP_BYTES).toBe(104_448);
    expect(NEAR_BYTES).toBe(81_920);
  });

  it('reports a small document as ok with parts largest first and no warnings', () => {
    const report = measureSize(result([part('a', 'xx'), part('b', 'xxxxx'), part('c', '')]));
    expect(report).toMatchObject({
      bytes: 7,
      limit: CLIP_BYTES,
      nearLimit: NEAR_BYTES,
      clipRisk: 'ok',
      clippedParts: [],
      unsubscribeClipped: false,
      warnings: [],
    });
    expect(report.perPart).toEqual([
      { id: 'b', bytes: 5 },
      { id: 'a', bytes: 2 },
    ]);
  });

  it('measures bytes, not characters', () => {
    expect(measureSize(result([part('a', '€€€')])).bytes).toBe(9);
  });

  it('warns when near the limit and says how much room is left', () => {
    const report = measureSize(result([part('a', 'x'.repeat(95))]), { limit: 100, nearLimit: 90 });
    expect(report.clipRisk).toBe('near');
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0]).toMatch(/close to the .* where Gmail clips it/);
  });

  it('is ok at exactly the near limit and near at exactly the clip limit', () => {
    expect(
      measureSize(result([part('a', 'x'.repeat(90))]), { limit: 100, nearLimit: 90 }).clipRisk,
    ).toBe('ok');
    expect(
      measureSize(result([part('a', 'x'.repeat(100))]), { limit: 100, nearLimit: 90 }).clipRisk,
    ).toBe('near');
    expect(
      measureSize(result([part('a', 'x'.repeat(101))]), { limit: 100, nearLimit: 90 }).clipRisk,
    ).toBe('over');
  });

  it('never lets the near limit sit above the limit', () => {
    const report = measureSize(result([part('a', 'x')]), { limit: 10, nearLimit: 50 });
    expect(report.nearLimit).toBe(10);
  });

  it('names the parts that start after the clip point when over', () => {
    const report = measureSize(
      result([part('top', 'x'.repeat(100)), part('tail', 'tail!'), part('empty', '')]),
      { limit: 100 },
    );
    expect(report.clipRisk).toBe('over');
    expect(report.clippedParts).toEqual(['tail']);
    expect(report.warnings[0]).toMatch(/over the .* where Gmail clips it/);
    expect(report.warnings[1]).toBe('Hidden by the clip: tail.');
  });

  it('says nothing is hidden when every part starts before the clip point', () => {
    const report = measureSize(result([part('only', 'x'.repeat(150))]), { limit: 100 });
    expect(report.clipRisk).toBe('over');
    expect(report.clippedParts).toEqual([]);
    expect(report.warnings).toHaveLength(1);
  });

  it('ignores a part whose output is not in the final document', () => {
    const report = measureSize(
      result([part('ghost', 'zzz'), part('real', 'x'.repeat(150))], 'x'.repeat(150)),
      {
        limit: 100,
      },
    );
    expect(report.clippedParts).toEqual([]);
  });

  it('warns when the unsubscribe link is after the clip point', () => {
    const html = `${'x'.repeat(100)}<a>Unsubscribe</a>`;
    const report = measureSize(result([part('footer', html)]), { limit: 100 });
    expect(report.unsubscribeClipped).toBe(true);
    expect(report.warnings.at(-1)).toMatch(/unsubscribe link is after the clip point/);
  });

  it('does not warn when the unsubscribe link is before the clip point or missing', () => {
    const early = measureSize(result([part('f', `<a>unsubscribe</a>${'x'.repeat(200)}`)]), {
      limit: 100,
    });
    expect(early.unsubscribeClipped).toBe(false);
    expect(measureSize(result([part('f', 'no link here')])).unsubscribeClipped).toBe(false);
  });

  it('measures a real render', () => {
    const letter = defineEmailTemplate({
      id: 'w',
      parts: [{ id: 'big', render: () => '<p>'.padEnd(120_000, 'x') }],
    });
    const report = measureSize(renderEmail(letter, { unsubscribeUrl: 'https://example.com/u' }));
    expect(report.clipRisk).toBe('over');
    expect(report.perPart[0]?.id).toBe('big');
    expect(report.clippedParts).toEqual(['footer']);
    expect(report.unsubscribeClipped).toBe(true);
  });
});

describe('toText', () => {
  it('returns an empty string for empty or markup-only input', () => {
    expect(toText('')).toBe('');
    expect(toText('<div></div><!-- note -->')).toBe('');
  });

  it('puts headings in uppercase and separates paragraphs with a blank line', () => {
    expect(toText('<h1>Weekly  <b>digest</b></h1><p>One</p><p>Two</p>')).toBe(
      'WEEKLY DIGEST\n\nOne\n\nTwo\n',
    );
  });

  it('turns lists into dashes and keeps items on consecutive lines', () => {
    expect(toText('<ul><li>One</li><li>Two <b>bold</b></li></ul><p>After</p>')).toBe(
      '- One\n- Two bold\n\nAfter\n',
    );
  });

  it('turns <br> into a line break', () => {
    expect(toText('<p>a<br>b<br/>c</p>')).toBe('a\nb\nc\n');
  });

  it('prints links as label (url), or once when the label is the url', () => {
    expect(toText('<a href="https://a.com/x">Site</a>')).toBe('Site (https://a.com/x)\n');
    expect(toText('<a href="https://a.com">https://a.com</a>')).toBe('https://a.com\n');
    expect(toText("<a class='b' href='https://a.com/s'>Single</a>")).toBe(
      'Single (https://a.com/s)\n',
    );
    expect(toText('<a href=https://a.com/u>Bare</a>')).toBe('Bare (https://a.com/u)\n');
  });

  it('prints just the url for an empty label and just the label for a useless href', () => {
    expect(toText('<a href="https://a.com/e"></a>')).toBe('https://a.com/e\n');
    expect(toText('<a href="">Empty</a>')).toBe('Empty\n');
    expect(toText('<a>No href</a>')).toBe('No href\n');
    expect(toText('<a href="#top">Top</a>')).toBe('Top\n');
    expect(toText('<a href="JavaScript:void(0)">Js</a>')).toBe('Js\n');
  });

  it('decodes entities in link labels', () => {
    expect(toText('<a href="https://a.com">Fish &amp; chips</a>')).toBe(
      'Fish & chips (https://a.com)\n',
    );
  });

  it('prints image alt text and drops images without it', () => {
    expect(toText('<p><img src="x" alt=" Logo "></p>')).toBe('[Logo]\n');
    expect(toText('<p>a<img src="x">b<img src="y" alt="">c</p>')).toBe('abc\n');
  });

  it('decodes named, decimal and hex entities and leaves unknown or invalid ones alone', () => {
    expect(
      toText('<p>&amp; &lt; &gt; &quot; &apos; &copy; &MDASH; &#8364; &#x20AC; &#X20ac;</p>'),
    ).toBe('& < > " \' © — € € €\n');
    expect(toText('<p>&nbsp;x&nbsp;</p>')).toBe('x\n');
    expect(toText('<p>&unknown; &#0; &#1114112;</p>')).toBe('&unknown; &#0; &#1114112;\n');
  });

  it('keeps the preheader as the first line, decoded', () => {
    const html =
      '<html><head><span class="x preheader y">Three &mdash; things</span></head><body><p>Body</p></body></html>';
    expect(toText(html)).toBe('Three — things\n\nBody\n');
  });

  it('works when the preheader is empty or absent', () => {
    expect(toText('<head><span class="preheader"></span></head><p>Body</p>')).toBe('Body\n');
    expect(toText('<head><title>T</title></head><p>Body</p>')).toBe('Body\n');
  });

  it('drops head, style, script, comments and display:none blocks', () => {
    const html =
      '<head><title>T</title><style>p{color:red}</style></head><script>alert(1)</script><!-- c --><p>Shown</p><div style="display: none">Hidden</div><span style="DISPLAY:NONE">Gone</span>';
    expect(toText(html)).toBe('Shown\n');
  });

  it('wraps long paragraphs at the width and leaves short lines alone', () => {
    const text = toText('<p>one two three four five six</p>', { width: 12 });
    expect(text).toBe('one two\nthree four\nfive six\n');
    expect(toText('<p>short</p>', { width: 12 })).toBe('short\n');
  });

  it('indents the continuation lines of a wrapped list item', () => {
    expect(toText('<ul><li>one two three four five</li></ul>', { width: 14 })).toBe(
      '- one two\n  three four\n  five\n',
    );
  });

  it('does not break a word longer than the width', () => {
    expect(toText('<p>https://example.com/a/very/long/path ok</p>', { width: 10 })).toBe(
      'https://example.com/a/very/long/path\nok\n',
    );
  });

  it('leaves lines unwrapped when the width is 0 and wraps at 78 by default', () => {
    const long = Array.from({ length: 40 }, () => 'word').join(' ');
    expect(toText(`<p>${long}</p>`, { width: 0 })).toBe(`${long}\n`);
    const wrapped = toText(`<p>${long}</p>`);
    expect(wrapped.split('\n').every((line) => line.length <= 78)).toBe(true);
    expect(wrapped.split('\n').length).toBeGreaterThan(2);
  });

  it('collapses runs of blank lines and whitespace', () => {
    expect(toText('<p>a   \t b</p>\n\n\n\n<p>c</p>')).toBe('a b\n\nc\n');
  });

  it('turns the email shell into readable text', () => {
    const rendered = renderEmail(
      { id: 'w', parts: [{ id: 'list', render: () => '<ul><li>Shipped</li><li>Fixed</li></ul>' }] },
      {
        title: 'T',
        preview: 'Preview line',
        heading: 'Weekly digest',
        bodyText: 'Hello <a href="https://example.com/x">our site</a>.',
        ctaLabel: 'Read more',
        ctaUrl: 'https://example.com/read',
        companyName: 'LLazyEmail',
        unsubscribeUrl: 'https://example.com/unsub',
      },
    );
    expect(toText(rendered.html)).toBe(
      [
        'Preview line',
        '',
        'WEEKLY DIGEST',
        '',
        'Hello our site (https://example.com/x).',
        '',
        'Read more (https://example.com/read)',
        '',
        '- Shipped',
        '- Fixed',
        '',
        'LLazyEmail',
        '',
        'Unsubscribe (https://example.com/unsub)',
        '',
      ].join('\n'),
    );
  });
});
