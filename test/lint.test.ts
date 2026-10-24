import { describe, expect, it } from 'vitest';
import type { PartTrace, RenderResult } from '../src/index';
import { lintEmail } from '../src/quality/lint';
import type { Rule } from '../src/quality/lint';

function part(id: string, html: string): PartTrace {
  return { id, status: 'ok', html, chars: html.length, ms: 0 };
}

function result(parts: PartTrace[], html?: string): RenderResult {
  return { templateId: 'demo', ok: true, html: html ?? parts.map((p) => p.html).join(''), parts };
}

describe('lintEmail', () => {
  it('returns no findings for a clean email', () => {
    const html =
      '<html lang="en"><head><title>Hi</title></head><body><a href="https://example.com/unsub">Unsubscribe</a><img alt="x" width="10" height="10" src="a.png"></body></html>';
    expect(lintEmail(result([part('main', html)], html))).toEqual([]);
  });

  it('flags flex, grid and float used for layout', () => {
    const findings = lintEmail(result([part('hero', '<div style="display:flex">x</div>')]));
    expect(findings.some((f) => f.rule === 'no-flex-grid-layout' && f.partId === 'hero')).toBe(
      true,
    );
  });

  it('flags external stylesheets', () => {
    const findings = lintEmail(result([part('head', '<link rel="stylesheet" href="a.css">')]));
    expect(findings.some((f) => f.rule === 'no-external-stylesheet')).toBe(true);
  });

  it('flags script, form, iframe and video', () => {
    const findings = lintEmail(
      result([part('bad', '<script>x</script><form></form><iframe></iframe><video></video>')]),
    );
    expect(findings.filter((f) => f.rule === 'no-script-or-form')).toHaveLength(1);
  });

  it('flags images missing alt, width or height', () => {
    const findings = lintEmail(
      result([part('img', '<img src="a.png"><img alt="x" width="1" src="b.png">')]),
    );
    expect(findings.filter((f) => f.rule === 'img-needs-alt-and-size')).toHaveLength(2);
  });

  it('flags bad link hrefs', () => {
    const findings = lintEmail(
      result([
        part(
          'links',
          '<a href="">x</a><a href="#">y</a><a href="javascript:void(0)">z</a><a href="mailto:a@b.c">m</a>',
        ),
      ]),
    );
    expect(findings.filter((f) => f.rule === 'link-hygiene')).toHaveLength(4);
  });

  it('flags missing lang and empty title', () => {
    const findings = lintEmail(
      result(
        [part('shell', '<html><head><title></title></head></html>')],
        '<html><head><title></title></head></html>',
      ),
    );
    expect(
      findings.some((f) => f.rule === 'html-lang-and-title' && f.message.includes('lang')),
    ).toBe(true);
    expect(
      findings.some((f) => f.rule === 'html-lang-and-title' && f.message.includes('title')),
    ).toBe(true);
  });

  it('flags a missing unsubscribe link', () => {
    const findings = lintEmail(
      result([part('body', '<p>Hello</p>')], '<html lang="en"><title>t</title><p>Hello</p></html>'),
    );
    expect(findings.some((f) => f.rule === 'unsubscribe-present')).toBe(true);
  });

  it('skips rules listed in off', () => {
    const findings = lintEmail(result([part('bad', '<div style="display:flex">x</div>')]), {
      off: ['no-flex-grid-layout'],
    });
    expect(findings.some((f) => f.rule === 'no-flex-grid-layout')).toBe(false);
  });

  it('runs extra rules', () => {
    const extra: Rule = () => [{ rule: 'custom', severity: 'info', message: 'custom' }];
    const findings = lintEmail(result([]), { rules: [extra] });
    expect(findings.some((f) => f.rule === 'custom')).toBe(true);
  });

  it('reports a finding that only appears in the final document', () => {
    const findings = lintEmail(
      result([part('p', '<p>ok</p>')], '<div style="display:flex">shell</div>'),
    );
    expect(findings.some((f) => f.rule === 'no-flex-grid-layout' && f.partId === undefined)).toBe(
      true,
    );
  });

  it('truncates long excerpts and accepts single-quoted and bare hrefs', () => {
    const long = '<div style="display:flex">' + 'x'.repeat(200) + '</div>';
    const findings = lintEmail(result([part('long', long)]));
    expect(findings[0].excerpt).toContain('…');
    const links = lintEmail(
      result([part('l', "<a href='https://a.com'>x</a><a href=https://b.com>y</a>")]),
    );
    expect(links.filter((f) => f.rule === 'link-hygiene')).toHaveLength(0);
  });

  it('handles a link with no href attribute', () => {
    const findings = lintEmail(result([part('l', '<a>no href</a>')]));
    expect(findings.some((f) => f.rule === 'link-hygiene')).toBe(true);
  });
});
