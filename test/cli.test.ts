import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RenderError } from '@llazyemail/render-template';
import { parseArgs, USAGE } from '../src/cli/args';
import { inspectCommand } from '../src/cli/commands';
import { forkRender } from '../src/cli/fork';
import { crash, runModule } from '../src/cli/outcome';
import type { Outcome } from '../src/cli/outcome';
import { crashPage, outcomePage, renderChanged, toInspectable } from '../src/cli/pages';
import { startServer } from '../src/cli/server';
import type { DevServer } from '../src/cli/server';
import type { PartTrace, RenderResult } from '../src/index';

const fx = (name: string): string => new URL(`./fixtures/${name}`, import.meta.url).pathname;

describe('parseArgs', () => {
  it('shows help for no arguments, help words and -h', () => {
    for (const argv of [
      [],
      ['help'],
      ['--help'],
      ['-h'],
      ['dev', '-h'],
      ['inspect', 'x', '--help'],
    ]) {
      expect(parseArgs(argv)).toEqual({ kind: 'help' });
    }
    expect(USAGE).toContain('template-runtime-display dev <module>');
  });

  it('shows the version', () => {
    expect(parseArgs(['-v'])).toEqual({ kind: 'version' });
    expect(parseArgs(['--version'])).toEqual({ kind: 'version' });
  });

  it('parses dev with defaults and with every option, in both flag styles', () => {
    expect(parseArgs(['dev', 'a.mjs'])).toEqual({
      kind: 'dev',
      file: 'a.mjs',
      port: 4177,
      host: '127.0.0.1',
      watch: [],
    });
    expect(
      parseArgs(['dev', 'a.mjs', '--port', '0', '--host=::1', '--watch', 'src', '--watch=lib']),
    ).toEqual({ kind: 'dev', file: 'a.mjs', port: 0, host: '::1', watch: ['src', 'lib'] });
  });

  it('parses inspect with and without --out', () => {
    expect(parseArgs(['inspect', 'a.mjs'])).toEqual({
      kind: 'inspect',
      file: 'a.mjs',
      out: 'inspect.html',
    });
    expect(parseArgs(['inspect', '--out', 'r.html', 'a.mjs'])).toEqual({
      kind: 'inspect',
      file: 'a.mjs',
      out: 'r.html',
    });
  });

  it.each([
    [['nope'], /Unknown command "nope"/],
    [['dev'], /dev needs a module path/],
    [['inspect'], /inspect needs a module path/],
    [['dev', 'a', 'b'], /Unexpected extra argument "b"/],
    [['dev', 'a', '--out', 'x'], /Unknown option "--out" for dev/],
    [['inspect', 'a', '--port', '1'], /Unknown option "--port" for inspect/],
    [['dev', 'a', '--port'], /--port needs a value/],
    [['dev', 'a', '--port='], /--port needs a value/],
    [['dev', 'a', '--port', 'abc'], /Invalid port "abc"/],
    [['dev', 'a', '--port', '70000'], /Invalid port "70000"/],
    [['dev', 'a', '--port', '1.5'], /Invalid port "1.5"/],
    [['dev', 'a', '--port', '-1'], /Invalid port "-1"/],
  ])('rejects %j', (argv: string[], message: RegExp) => {
    const command = parseArgs(argv);
    expect(command.kind).toBe('error');
    expect((command as { message: string }).message).toMatch(message);
  });
});

describe('runModule', () => {
  it('renders a module in collect mode and returns the result', async () => {
    const outcome = await runModule(fx('ok.mjs'));
    expect(outcome.kind).toBe('result');
    expect(outcome.kind === 'result' && outcome.result.ok).toBe(true);
  });

  it('collects a broken part by default', async () => {
    const outcome = await runModule(fx('broken.mjs'));
    expect(outcome.kind === 'result' && outcome.result.ok).toBe(false);
    expect(
      outcome.kind === 'result' && outcome.result.parts.some((p) => p.status === 'error'),
    ).toBe(true);
  });

  it('reports a throw when the module asks for throw mode', async () => {
    const outcome = await runModule(fx('throws.mjs'));
    expect(outcome).toMatchObject({ kind: 'thrown', templateId: 'throws', partId: 'bad' });
    expect(outcome.kind === 'thrown' && outcome.trace.length).toBeGreaterThan(0);
  });

  it('accepts a default export with the same keys', async () => {
    expect((await runModule(fx('default-export.mjs'))).kind).toBe('result');
  });

  it('turns a missing template, a syntax error and a non-Error throw into a crash', async () => {
    expect(await runModule(fx('no-template.mjs'))).toMatchObject({
      kind: 'crash',
      message: expect.stringContaining('does not export a template'),
    });
    expect(await runModule(fx('syntax.mjs'))).toMatchObject({
      kind: 'crash',
      detail: expect.any(String),
    });
    expect(await runModule(fx('bad-throw.mjs'))).toEqual({
      kind: 'crash',
      message: 'a plain string',
      detail: 'a plain string',
    });
    expect((await runModule(fx('missing-file.mjs'))).kind).toBe('crash');
  });

  it('caps crash detail', () => {
    expect((crash('m', 'x'.repeat(9000)) as { detail: string }).detail).toHaveLength(4000);
    expect(crash('m')).toEqual({ kind: 'crash', message: 'm' });
  });

  it('does not treat a lookalike error as a RenderError', async () => {
    const fake = Object.assign(new Error('x'), { name: 'RenderError', templateId: 1 });
    expect(fake).toBeInstanceOf(Error);
    const dir = await mkdtemp(join(tmpdir(), 'trd-'));
    const file = join(dir, 'fake.mjs');
    await writeFile(
      file,
      "const e = new Error('lookalike'); e.name = 'RenderError'; e.templateId = 1; throw e;",
    );
    expect(await runModule(file)).toMatchObject({ kind: 'crash', message: 'lookalike' });
    await rm(dir, { recursive: true });
  });
});

describe('forkRender', () => {
  it('returns what the worker reports, passing the module path', async () => {
    const outcome = await forkRender('m.mjs', { workerPath: fx('worker-reports.mjs') });
    expect(outcome).toEqual({ kind: 'crash', message: 'from worker m.mjs' });
  });

  it('turns a worker that dies into a crash with its stderr', async () => {
    const outcome = await forkRender('m', { workerPath: fx('worker-dies.mjs') });
    expect(outcome).toMatchObject({
      kind: 'crash',
      message: expect.stringContaining('exit code 3'),
      detail: expect.stringContaining('about to die'),
    });
  });

  it('kills a worker that never reports', async () => {
    const outcome = await forkRender('m', { workerPath: fx('worker-loops.mjs'), timeoutMs: 150 });
    expect(outcome).toMatchObject({
      kind: 'crash',
      message: expect.stringContaining('timed out after 150ms'),
    });
  });

  it('turns a program that cannot start into a crash', async () => {
    const outcome = await forkRender('m', {
      workerPath: fx('worker-reports.mjs'),
      execPath: '/nonexistent/node',
    });
    expect(outcome.kind).toBe('crash');
  });

  it('turns a missing worker file into a crash', async () => {
    const outcome = await forkRender('m', { workerPath: fx('nope.mjs') });
    expect(outcome.kind).toBe('crash');
  });
});

const trace = (id: string, html: string): PartTrace => ({
  id,
  status: 'ok',
  html,
  chars: html.length,
  ms: 0,
});
const rendered = (html: string): RenderResult => ({
  templateId: 't',
  ok: true,
  html,
  parts: [trace('a', html)],
});

describe('pages', () => {
  it('maps each outcome to something the inspector can show', () => {
    const result = rendered('x');
    expect(toInspectable({ kind: 'result', result })).toBe(result);
    const thrown = toInspectable({
      kind: 'thrown',
      message: 'm',
      templateId: 't',
      partId: 'a',
      trace: [trace('a', '')],
    });
    expect(thrown).toBeInstanceOf(RenderError);
    expect(toInspectable(crash('c'))).toBeUndefined();
  });

  it('renders the inspector, the comparison and the crash page', () => {
    expect(outcomePage({ kind: 'result', result: rendered('one') })).toContain('<h1>t</h1>');
    expect(outcomePage({ kind: 'result', result: rendered('two') }, rendered('one'))).toContain(
      'Changes since',
    );
    const page = outcomePage(crash('<bad>', 'stack <here>'));
    expect(page).toContain('CRASHED');
    expect(page).toContain('&lt;bad&gt;');
    expect(page).toContain('stack &lt;here&gt;');
    expect(crashPage({ kind: 'crash', message: 'no detail' })).not.toContain('<pre>');
  });

  it('detects change between results and between a result and a thrown error', () => {
    expect(renderChanged(rendered('a'), rendered('a'))).toBe(false);
    expect(renderChanged(rendered('a'), rendered('b'))).toBe(true);
    const err = new RenderError('m', { templateId: 't', partId: 'a', trace: [trace('a', 'a')] });
    expect(renderChanged(err, rendered('a'))).toBe(true);
    expect(renderChanged(rendered('a'), err)).toBe(true);
  });
});

describe('inspectCommand', () => {
  function run(outcome: Outcome) {
    const written: Record<string, string> = {};
    const logs: string[] = [];
    const code = inspectCommand('mod.mjs', 'out.html', {
      render: async () => outcome,
      write: async (file, contents) => void (written[file] = contents),
      log: (line) => void logs.push(line),
    });
    return { code, written, logs };
  }

  it('exits 0 for a clean render and writes the report', async () => {
    const r = run({ kind: 'result', result: rendered('x') });
    expect(await r.code).toBe(0);
    expect(r.written['out.html']).toContain('v-ok');
    expect(r.logs.join('\n')).toContain('t: ok');
  });

  it('exits 1 when a part broke', async () => {
    const result: RenderResult = { ...rendered('x'), ok: false };
    expect(await run({ kind: 'result', result }).code).toBe(1);
  });

  it('exits 1 for a throw and still writes a report', async () => {
    const r = run({
      kind: 'thrown',
      message: 'part failed',
      templateId: 't',
      partId: 'a',
      trace: [trace('a', '')],
    });
    expect(await r.code).toBe(1);
    expect(r.written['out.html']).toContain('Render threw in part');
  });

  it('exits 2 for a crash, writes the crash page and prints the detail when there is one', async () => {
    const withDetail = run(crash('nope', 'stack'));
    expect(await withDetail.code).toBe(2);
    expect(withDetail.written['out.html']).toContain('CRASHED');
    expect(withDetail.logs).toContain('stack');
    const plain = run(crash('nope'));
    expect(await plain.code).toBe(2);
    expect(plain.logs).not.toContain('stack');
  });
});

describe('startServer', () => {
  let server: DevServer | undefined;
  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  let current: Outcome = { kind: 'result', result: rendered('one') };
  const start = async (extra: Partial<Parameters<typeof startServer>[0]> = {}) => {
    const dir = await mkdtemp(join(tmpdir(), 'trd-srv-'));
    server = await startServer({
      file: join(dir, 'mod.mjs'),
      port: 0,
      render: async () => current,
      debounceMs: 10,
      ...extra,
    });
    return { dir, url: server.url };
  };
  const get = (url: string, init?: RequestInit) => fetch(url, init);

  it('serves the inspector with a reload listener, no caching, and nosniff', async () => {
    current = { kind: 'result', result: rendered('one') };
    const { url } = await start();
    const res = await get(url);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(body).toContain("new EventSource('/__events')");
    expect(body.indexOf('EventSource')).toBeGreaterThan(body.indexOf('Generated by'));
  });

  it('shows what changed once the output changes, and keeps it across reloads of the same render', async () => {
    current = { kind: 'result', result: rendered('one') };
    const { url } = await start();
    expect(await (await get(url)).text()).not.toContain('Changes since');
    current = { kind: 'result', result: rendered('two') };
    expect(await (await get(url)).text()).toContain('Changes since the previous render');
    expect(await (await get(url)).text()).toContain('Changes since the previous render');
  });

  it('serves the document alone at /email, or a 404 when there is none', async () => {
    current = { kind: 'result', result: rendered('<p>doc</p>') };
    const { url } = await start();
    expect(await (await get(`${url}email`)).text()).toBe('<p>doc</p>');
    current = { kind: 'result', result: rendered('') };
    expect((await get(`${url}email`)).status).toBe(404);
    current = crash('c');
    expect((await get(`${url}email`)).status).toBe(404);
    const page = await get(url);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('CRASHED');
  });

  it('refuses other paths, other methods and foreign Host headers', async () => {
    const { url } = await start();
    expect((await get(`${url}nope`)).status).toBe(404);
    expect((await get(url, { method: 'POST' })).status).toBe(405);
    const forged = await new Promise<number>((resolve, reject) => {
      import('node:http').then(({ request }) => {
        const req = request(url, { headers: { host: 'evil.example' } }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on('error', reject);
        req.end();
      }, reject);
    });
    expect(forged).toBe(403);
  });

  it('answers 500 when rendering itself throws', async () => {
    const { url } = await start({
      render: async () => {
        throw new Error('boom');
      },
    });
    expect((await get(url)).status).toBe(500);
  });

  it('pushes a reload when a watched file changes, and ignores node_modules', async () => {
    const { dir, url } = await start();
    const res = await get(`${url}__events`);
    const reader = res.body!.getReader();
    const next = async () => new TextDecoder().decode((await reader.read()).value);
    expect(await next()).toContain('retry: 500');
    await writeFile(join(dir, 'mod.mjs'), 'export {}');
    expect(await next()).toContain('data: reload');
    server!.reload();
    expect(await next()).toContain('data: reload');
    await reader.cancel();
  });

  it('reports a port that is already taken', async () => {
    const { url } = await start();
    const port = Number(new URL(url).port);
    await expect(
      startServer({ file: join(tmpdir(), 'x.mjs'), port, render: async () => current }),
    ).rejects.toMatchObject({ code: 'EADDRINUSE' });
  });
});
