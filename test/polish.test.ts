import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RenderError, inspect, traceJson, traceJsonText } from '../src/index';
import type { PartStatus, PartTrace, RenderResult } from '../src/index';
import { parseArgs } from '../src/cli/args';
import { crashJsonText, inspectCommand } from '../src/cli/commands';
import { crash } from '../src/cli/outcome';
import type { Outcome } from '../src/cli/outcome';
import { startServer } from '../src/cli/server';
import { withScheme } from '../src/inspect/scheme';
import type { DevServer } from '../src/cli/server';

function part(id: string, html: string, status: PartStatus = 'ok', extra: Partial<PartTrace> = {}) {
  return { id, status, html, chars: html.length, ms: 1, ...extra } satisfies PartTrace;
}

function result(
  parts: PartTrace[],
  html?: string,
  extra: Partial<RenderResult> = {},
): RenderResult {
  return {
    templateId: 'demo',
    ok: parts.every((p) => p.status !== 'error'),
    html: html ?? parts.map((p) => p.html).join('\n'),
    parts,
    ...extra,
  };
}

describe('inspect: size section', () => {
  it('shows bytes, the limit, a meter, the largest parts and no warning for a small document', () => {
    const html = inspect(result([part('small', 'x'.repeat(10)), part('big', 'x'.repeat(2048))]));
    expect(html).toContain('<h2>Size</h2>');
    expect(html).toContain('<strong>2.0 KB</strong> of 102.0 KB');
    expect(html).toContain('class="chip s-ok">ok</span>');
    expect(html).toContain('class="fill r-ok" style="--w:2.0%"');
    const half = inspect(result([part('p', 'x'.repeat(51_200))]));
    expect(half).toContain('class="fill r-ok" style="--w:49.0%"');
    expect(html).toContain('class="mark" style="--at:78.4%"');
    expect(html).toContain('<span class="name">big</span> <span class="meta">2.0 KB</span>');
    expect(html).toContain('<span class="name">small</span> <span class="meta">10 B</span>');
    expect(html).not.toContain('class="warns"');
  });

  it('warns near the limit and when over, and fills the meter', () => {
    const near = inspect(result([part('p', 'x'.repeat(90_000))]));
    expect(near).toContain('class="chip s-empty">near</span>');
    expect(near).toContain('class="fill r-near"');
    expect(near).toContain('class="warns"');
    expect(near).toContain('close to the');

    const over = inspect(result([part('top', 'x'.repeat(110_000)), part('footer', 'Unsubscribe')]));
    expect(over).toContain('class="chip s-error">over</span>');
    expect(over).toContain('class="fill r-over" style="--w:100.0%"');
    expect(over).toContain('Hidden by the clip: footer.');
    expect(over).toContain('unsubscribe link is after the clip point');
  });

  it('lists at most five parts', () => {
    const parts = Array.from({ length: 7 }, (_, i) => part(`p${i}`, 'x'.repeat(i + 1)));
    const html = inspect(result(parts));
    const sizes = html.match(/<ul class="sizes">[\s\S]*?<\/ul>/)?.[0] ?? '';
    expect(sizes.match(/<li>/g)).toHaveLength(5);
  });

  it('is left out when there is no document', () => {
    const html = inspect(result([], ''));
    expect(html).not.toContain('<h2>Size</h2>');
    expect(html).not.toContain('Plain-text version');
  });
});

describe('inspect: plain text section', () => {
  it('shows the plain-text version, escaped, with a line count', () => {
    const html = inspect(result([part('a', '<h1>Hi</h1><p>1 &lt; 2</p>')]));
    expect(html).toContain('Plain-text version');
    expect(html).toContain('<span class="meta">3 lines · click the text to select it all</span>');
    expect(html).toContain('<pre class="src"><code>HI\n\n1 &lt; 2\n</code></pre>');
  });

  it('uses the singular for one line', () => {
    expect(inspect(result([part('a', '<p>Only</p>')]))).toContain('1 line · click');
  });

  it('says so when the document has no text', () => {
    const html = inspect(result([part('a', '<div></div>')]));
    expect(html).toContain('0 lines · click');
    expect(html).toContain('The document has no text.');
  });
});

describe('inspect: preview and navigation', () => {
  it('offers Light and Dark next to the width choices, each with its own pinned frame', () => {
    const html = inspect(result([part('a', '<html><head></head><p>A</p></html>')]));
    expect(html).toContain('id="sc-light" checked');
    expect(html).toContain('for="sc-dark">Dark</label>');
    expect(html).toContain('name="sc"');
    expect(html).toContain('title="Rendered document" class="doc-light"');
    expect(html).toContain('title="Rendered document, dark" class="doc-dark"');
    expect(html).toContain('&lt;head&gt;&lt;style&gt;:root{color-scheme:light}&lt;/style&gt;');
    expect(html).toContain('&lt;head&gt;&lt;style&gt;:root{color-scheme:dark}&lt;/style&gt;');
    expect(html).toContain('prefers-color-scheme</code> styles follow your system setting');
  });

  it('links each part card to its neighbours, and omits links that go nowhere', () => {
    const three = inspect(result([part('a', 'A'), part('b', 'B'), part('c', 'C')]));
    const cards = three.split('<details class="part"').slice(1);
    expect(cards[0]).toContain('<a href="#part-1">next');
    expect(cards[0]).not.toContain('previous');
    expect(cards[1]).toContain('<a href="#part-0">&uarr; previous</a><a href="#part-2">next');
    expect(cards[2]).toContain('<a href="#part-1">&uarr; previous</a>');
    expect(cards[2]).not.toContain('next &darr;');
    expect(inspect(result([part('only', 'x')]))).not.toContain('class="pn"');
  });
});

describe('traceJson', () => {
  it('describes parts by status, size, timing and error, without markup by default', () => {
    const json = traceJson(
      result([
        part('ok', '<p>€</p>'),
        part('bad', '', 'error', { error: { name: 'TypeError', message: 'nope' } }),
      ]),
    );
    expect(json).toMatchObject({
      templateId: 'demo',
      ok: false,
      size: { clipRisk: 'ok', warnings: [] },
    });
    expect(json.parts[0]).toEqual({ id: 'ok', status: 'ok', chars: 8, bytes: 10, ms: 1 });
    expect(json.parts[1]).toMatchObject({ id: 'bad', status: 'error', error: { message: 'nope' } });
    expect(json.html).toBeUndefined();
    expect(json.threw).toBeUndefined();
    expect(json.composeError).toBeUndefined();
    expect('html' in (json.parts[0] ?? {})).toBe(false);
  });

  it('includes the markup on request', () => {
    const json = traceJson(result([part('a', '<p>A</p>')], '<main><p>A</p></main>'), {
      html: true,
    });
    expect(json.html).toBe('<main><p>A</p></main>');
    expect(json.parts[0]?.html).toBe('<p>A</p>');
  });

  it('records a compose error', () => {
    const json = traceJson(
      result([part('a', 'A')], '', { ok: false, composeError: { name: 'E', message: 'join' } }),
    );
    expect(json.composeError).toEqual({ name: 'E', message: 'join' });
  });

  it('names the part that threw', () => {
    const error = new RenderError('part "b" failed', {
      templateId: 'demo',
      partId: 'b',
      trace: [part('a', 'A'), part('b', '', 'error', { error: { name: 'E', message: 'x' } })],
    });
    const json = traceJson(error);
    expect(json.threw).toEqual({ partId: 'b', message: 'part "b" failed' });
    expect(json.ok).toBe(false);
  });

  it('reports the Gmail size check', () => {
    const json = traceJson(result([part('a', 'x'.repeat(110_000))]));
    expect(json.size.clipRisk).toBe('over');
    expect(json.size.warnings.length).toBeGreaterThan(0);
  });

  it('prints pretty JSON with a trailing newline that parses back', () => {
    const text = traceJsonText(result([part('a', 'A')]));
    expect(text.endsWith('}\n')).toBe(true);
    expect(JSON.parse(text).templateId).toBe('demo');
    expect(JSON.parse(traceJsonText(result([part('a', 'A')]), { html: true })).html).toBe('A');
  });
});

describe('inspect --json', () => {
  it('parses --json in both flag styles and leaves it out otherwise', () => {
    expect(parseArgs(['inspect', 'a.mjs', '--json', 't.json'])).toEqual({
      kind: 'inspect',
      file: 'a.mjs',
      out: 'inspect.html',
      json: 't.json',
    });
    expect(parseArgs(['inspect', 'a.mjs', '--json=t.json'])).toMatchObject({ json: 't.json' });
    expect('json' in parseArgs(['inspect', 'a.mjs'])).toBe(false);
    expect(parseArgs(['inspect', 'a.mjs', '--json'])).toMatchObject({ kind: 'error' });
    expect(parseArgs(['dev', 'a.mjs', '--json', 'x'])).toMatchObject({ kind: 'error' });
  });

  function run(outcome: Outcome, jsonOut?: string) {
    const written: Record<string, string> = {};
    const code = inspectCommand(
      'mod.mjs',
      'out.html',
      {
        render: async () => outcome,
        write: async (file, contents) => void (written[file] = contents),
        log: () => undefined,
      },
      jsonOut,
    );
    return { code, written };
  }

  it('writes the trace next to the report for a result and for a throw', async () => {
    const ok = run({ kind: 'result', result: result([part('a', 'A')]) }, 't.json');
    expect(await ok.code).toBe(0);
    expect(JSON.parse(ok.written['t.json'] ?? '').ok).toBe(true);

    const thrown = run(
      {
        kind: 'thrown',
        message: 'failed',
        templateId: 'demo',
        partId: 'a',
        trace: [part('a', '')],
      },
      't.json',
    );
    expect(await thrown.code).toBe(1);
    expect(JSON.parse(thrown.written['t.json'] ?? '').threw.partId).toBe('a');
  });

  it('writes a crash description when there was nothing to render', async () => {
    const run1 = run(crash('nope', 'stack'), 't.json');
    expect(await run1.code).toBe(2);
    expect(JSON.parse(run1.written['t.json'] ?? '')).toEqual({
      ok: false,
      crash: { message: 'nope', detail: 'stack' },
    });
    expect(JSON.parse(crashJsonText({ kind: 'crash', message: 'm' }))).toEqual({
      ok: false,
      crash: { message: 'm' },
    });
  });

  it('writes no JSON unless asked', async () => {
    const plain = run({ kind: 'result', result: result([part('a', 'A')]) });
    await plain.code;
    expect(Object.keys(plain.written)).toEqual(['out.html']);
    const crashed = run(crash('x'));
    await crashed.code;
    expect(Object.keys(crashed.written)).toEqual(['out.html']);
  });
});

describe('dev server /trace.json', () => {
  let server: DevServer | undefined;
  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  async function start(outcome: Outcome) {
    const dir = await mkdtemp(join(tmpdir(), 'trd-trace-'));
    server = await startServer({ file: join(dir, 'm.mjs'), port: 0, render: async () => outcome });
    return server.url;
  }

  it('serves the render as JSON', async () => {
    const url = await start({ kind: 'result', result: result([part('a', 'A')]) });
    const res = await fetch(`${url}trace.json`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(((await res.json()) as { templateId: string }).templateId).toBe('demo');
  });

  it('serves a thrown render too', async () => {
    const url = await start({
      kind: 'thrown',
      message: 'failed',
      templateId: 'demo',
      partId: 'a',
      trace: [part('a', '')],
    });
    const body = (await (await fetch(`${url}trace.json`)).json()) as { threw: { partId: string } };
    expect(body.threw.partId).toBe('a');
  });

  it('answers 404 when the module could not be rendered', async () => {
    const url = await start(crash('nope'));
    const res = await fetch(`${url}trace.json`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('No trace');
  });
});

describe('withScheme', () => {
  it('inserts the style right after <head>, keeping attributes on the tag', () => {
    expect(withScheme('<html><head lang="x"><title>T</title></head></html>', 'dark')).toBe(
      '<html><head lang="x"><style>:root{color-scheme:dark}</style><title>T</title></head></html>',
    );
    expect(withScheme('<HEAD></HEAD>', 'light')).toBe(
      '<HEAD><style>:root{color-scheme:light}</style></HEAD>',
    );
  });

  it('keeps the doctype first when there is no head', () => {
    expect(withScheme('<!DOCTYPE html><p>x</p>', 'dark')).toBe(
      '<!DOCTYPE html><style>:root{color-scheme:dark}</style><p>x</p>',
    );
    expect(withScheme('  <!doctype html>\n<p>x</p>', 'light')).toBe(
      '  <!doctype html><style>:root{color-scheme:light}</style>\n<p>x</p>',
    );
  });

  it('starts a fragment with the style', () => {
    expect(withScheme('<p>x</p>', 'dark')).toBe('<style>:root{color-scheme:dark}</style><p>x</p>');
    expect(withScheme('', 'light')).toBe('<style>:root{color-scheme:light}</style>');
  });

  it('does not mistake <header> for <head>', () => {
    expect(withScheme('<header>h</header>', 'dark')).toBe(
      '<style>:root{color-scheme:dark}</style><header>h</header>',
    );
  });
});
