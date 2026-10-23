import { describe, expect, it } from 'vitest';
import {
  defineEmailTemplate,
  defineTemplate,
  inspect,
  renderEmail,
  renderTemplate,
  RenderError,
  slot,
} from '../src/index';
import type { PartStatus, PartTrace, RenderResult } from '../src/index';

function part(
  id: string,
  html: string,
  status: PartStatus = 'ok',
  extra: Partial<PartTrace> = {},
): PartTrace {
  return { id, status, html, chars: html.length, ms: 0, ...extra };
}

function result(parts: PartTrace[], overrides: Partial<RenderResult> = {}): RenderResult {
  return {
    templateId: 'demo',
    ok: parts.every((p) => p.status !== 'error'),
    html: parts.map((p) => p.html).join('\n'),
    parts,
    ...overrides,
  };
}

const letter = defineEmailTemplate({
  id: 'weekly',
  parts: [
    {
      id: 'promo',
      render: (ctx) => `<p>Code ${(ctx.props as { code?: string }).code!.toUpperCase()}</p>`,
    },
    { id: 'note', render: (ctx) => slot(ctx, 'note') },
  ],
});

describe('inspect: a healthy render', () => {
  const html = inspect(renderEmail(letter, { title: 'Hi', heading: 'Hi', code: 'x1' } as never));

  it('is a complete HTML5 page', () => {
    expect(html.startsWith('<!DOCTYPE html>\n<html lang="en">')).toBe(true);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<title>Inspect · weekly</title>');
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('shows the verdict, the template id and a summary line', () => {
    expect(html).toContain('v-ok">OK</span>');
    expect(html).toContain('<h1>weekly</h1>');
    expect(html).toMatch(/5 parts · [\d,]+ chars · /);
  });

  it('draws one timeline row and one part card per part', () => {
    for (const id of ['head', 'main', 'promo', 'note', 'footer']) {
      expect(html).toContain(`<span class="name">${id}</span>`);
    }
    expect(html.match(/class="row"/g)).toHaveLength(5);
    expect(html.match(/<details class="part"/g)).toHaveLength(5);
  });

  it('shows no failure banner and opens no part card', () => {
    expect(html).not.toContain('role="alert"');
    expect(html).not.toMatch(/<details class="part" id="part-\d+" open>/);
  });

  it('has no scripts, no network requests and never prints "undefined"', () => {
    expect(html).not.toMatch(/<script|<link|https?:\/\/[^"' ]+\.(js|css)/i);
    expect(html).not.toContain('undefined');
  });

  it('offers the document at three widths in a sandboxed frame', () => {
    expect(html).toContain('id="vp-full" checked');
    expect(html).toContain('for="vp-tablet">Tablet 768');
    expect(html).toContain('for="vp-mobile">Mobile 375');
    expect(html).toContain(
      '<iframe sandbox="" referrerpolicy="no-referrer" title="Rendered document"',
    );
  });

  it('is deterministic for the same trace', () => {
    const fixed = result([part('a', '<p>A</p>')]);
    expect(inspect(fixed)).toBe(inspect(fixed));
  });
});

describe('inspect: escaping', () => {
  const hostile = '<script>alert("x")</script><img src=x onerror=alert(1)>';

  it('never lets part HTML, ids, messages or titles through unescaped', () => {
    const html = inspect(
      result(
        [
          part('<b>id</b>', hostile),
          part('bad', '', 'error', { error: { name: '<Err>', message: hostile } }),
        ],
        { templateId: '"><svg onload=alert(1)>' },
      ),
      { title: '<title>pwned' },
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<svg onload');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>id</b>');
    expect(html).not.toContain('<title>pwned');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('<title>&lt;title&gt;pwned</title>');
  });

  it('puts part HTML only into sandboxed frames and escaped blocks', () => {
    const html = inspect(result([part('a', hostile)]));
    const frames = html.match(/<iframe [^>]*>/g) ?? [];
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((tag) => tag.includes('sandbox=""'))).toBe(true);
    expect(html).not.toContain('allow-scripts');
  });
});

describe('inspect: a part that broke (collect mode)', () => {
  const broken = renderEmail(letter, { title: 'Hi' }, { onError: 'collect' });
  const html = inspect(broken);

  it('says FAILED and names the part in a banner that links to its card', () => {
    expect(html).toContain('v-bad">FAILED</span>');
    expect(html).toContain('<strong>1 part broke</strong>');
    expect(html).toMatch(/<a href="#part-2">promo<\/a>: TypeError: /);
  });

  it('opens the broken part and explains it rendered nothing', () => {
    expect(html).toMatch(/<details class="part" id="part-2" open>/);
    expect(html).toContain('Rendered nothing because it failed.');
    expect(html).toContain('class="chip s-error">error</span>');
  });

  it('still shows the output of the parts that did run', () => {
    expect(broken.parts.find((p) => p.id === 'head')?.html).toBeTruthy();
    expect(html).toContain('title="Preview of head"');
  });

  it('counts several broken parts', () => {
    const two = result([
      part('a', '', 'error', { error: { name: 'E', message: 'one' } }),
      part('b', '', 'error', { error: { name: 'E', message: 'two' } }),
    ]);
    expect(inspect(two)).toContain('<strong>2 parts broke</strong>');
  });

  it('falls back to a generic error when the trace has no error detail', () => {
    expect(inspect(result([part('a', '', 'error')]))).toContain('>a</a>: Error: </li>');
  });

  it('shows the error box and the partial output when a failed part left HTML behind', () => {
    const html2 = inspect(
      result([part('a', '<p>partial</p>', 'error', { error: { name: 'E', message: 'late' } })]),
    );
    expect(html2).toContain('<div class="banner inline"><strong>E</strong><pre>late</pre></div>');
    expect(html2).toContain('title="Preview of a"');
    expect(html2).not.toContain('Rendered nothing because it failed.');
  });
});

describe('inspect: a render that threw', () => {
  const page = defineTemplate<Record<string, never>>({
    id: 'page',
    parts: [
      { id: 'one', render: () => '<p>1</p>' },
      {
        id: 'two',
        render: () => {
          throw new Error('boom');
        },
      },
      { id: 'three', render: () => '<p>3</p>' },
    ],
    compose: (parts) => Object.values(parts).join(''),
  });

  function thrown(): RenderError {
    try {
      renderTemplate(page, {});
    } catch (error) {
      return error as RenderError;
    }
    throw new Error('expected a throw');
  }

  const html = inspect(thrown());

  it('reports the throw, the part, and that there is no document', () => {
    expect(html).toContain('Render threw in part “two”');
    expect(html).toContain('v-bad">FAILED</span>');
    expect(html).toContain('No document. Compose did not run or produced nothing.');
  });

  it('marks the parts after the failure as skipped, with a note instead of a preview', () => {
    expect(html).toContain('class="chip s-skipped">skipped</span>');
    expect(html).toContain('Skipped because an earlier part failed.');
    expect(html).toContain('class="bar skipped"');
  });
});

describe('inspect: compose failures and edge shapes', () => {
  it('shows a compose error', () => {
    const html = inspect(
      result([part('a', '<p>A</p>')], {
        ok: false,
        html: '',
        composeError: { name: 'TypeError', message: 'cannot join' },
      }),
    );
    expect(html).toContain('<strong>compose failed</strong>');
    expect(html).toContain('TypeError: cannot join');
  });

  it('handles a result with no parts', () => {
    const html = inspect(result([], { html: '' }));
    expect(html).toContain('0 parts');
    expect(html).not.toContain('Output by part');
    expect(html).not.toContain('<h2>Parts</h2>');
  });

  it('uses the singular for one part', () => {
    expect(inspect(result([part('a', 'A')]))).toContain('1 part ·');
  });

  it('says an empty part rendered an empty string and shows no frame for it', () => {
    const html = inspect(result([part('a', '', 'empty')]));
    expect(html).toContain('Rendered an empty string.');
    expect(html).toContain('class="bar b-empty"');
    expect(html).not.toContain('title="Preview of a"');
  });

  it('sizes timeline bars by output and keeps a minimum width', () => {
    const html = inspect(result([part('big', 'x'.repeat(100)), part('tiny', 'x')]));
    expect(html).toContain('--w:100.0%');
    expect(html).toContain('--w:2.0%');
  });

  it('uses the minimum width for every bar when nothing rendered', () => {
    const html = inspect(result([part('a', '', 'empty')]));
    expect(html).toContain('--w:2.0%');
  });

  it('formats durations and large character counts', () => {
    const html = inspect(
      result([
        part('fast', 'x', 'ok', { ms: 0.004 }),
        part('mid', 'x', 'ok', { ms: 0.5 }),
        part('slow', 'x'.repeat(1234), 'ok', { ms: 12.34 }),
      ]),
    );
    expect(html).toContain('&lt;0.01ms');
    expect(html).not.toContain('<0.01ms');
    expect(html).toContain('0.50ms');
    expect(html).toContain('12.3ms');
    expect(html).toContain('1,234 chars');
    expect(html).toContain('slowest: slow (12.3ms)');
  });

  it('leaves the slowest part out when everything is instant', () => {
    expect(inspect(result([part('a', 'A')]))).not.toContain('slowest');
  });

  it('accepts a custom title', () => {
    expect(inspect(result([]), { title: 'Mine' })).toContain('<title>Mine</title>');
  });
});

describe('inspect: compareTo', () => {
  const before = result([part('a', 'A'), part('b', 'old')], { html: 'top\nold\nend' });
  const after = result([part('a', 'A'), part('b', 'new!')], { html: 'top\nnew!\nend' });

  it('says so when nothing changed', () => {
    expect(inspect(before, { compareTo: before })).toContain(
      'No changes since the previous render.',
    );
  });

  it('lists what changed and shows the changed lines', () => {
    const html = inspect(after, { compareTo: before });
    expect(html).toContain('Changes since the previous render');
    expect(html).toContain(
      '<span class="name">b</span> <span class="chip c-changed">changed</span>',
    );
    expect(html).toContain('+1 chars');
    expect(html).toContain('<span class="d-del">- old</span>');
    expect(html).toContain('<span class="d-add">+ new!</span>');
    expect(html).toContain('<span class="d-same">  top</span>');
  });

  it('accepts a thrown RenderError as the earlier render', () => {
    const error = new RenderError('part "b" failed', {
      templateId: 'demo',
      partId: 'b',
      trace: [part('a', 'A'), part('b', '', 'error', { error: { name: 'E', message: 'x' } })],
    });
    const html = inspect(after, { compareTo: error });
    expect(html).toContain('Changes since the previous render');
    expect(html).toContain('c-changed');
  });

  it('omits the section when no earlier render is given', () => {
    expect(inspect(after)).not.toContain('Changes');
  });
});
