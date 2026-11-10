import { describe, expect, it } from 'vitest';
import { inspect, traceJson } from '../src/index';
import type { Finding, PartTrace, RenderResult } from '../src/index';
import { parseArgs } from '../src/cli/args';
import { inspectCommand } from '../src/cli/commands';
import type { Outcome } from '../src/cli/outcome';
import {
  failingFindings,
  findingsFor,
  sortFindings,
  summarizeFindings,
} from '../src/inspect/findings';

const GOOD =
  '<!doctype html><html lang="en"><head><title>Hi</title></head><body><p>Hello <a href="https://x.test/unsubscribe">Unsubscribe</a></p></body></html>';
const BAD = '<html><body><div style="display:flex">x</div><img src="a.png"></body></html>';

function part(id: string, html: string): PartTrace {
  return { id, status: 'ok', html, chars: html.length, ms: 1 };
}

function result(html: string, parts: PartTrace[] = [part('main', html)]): RenderResult {
  return { templateId: 'demo', ok: true, html, parts };
}

const f = (severity: Finding['severity'], rule = 'r'): Finding => ({
  rule,
  severity,
  message: `m-${rule}`,
});

describe('findings helpers', () => {
  it('lints a document and skips an empty one', () => {
    expect(findingsFor(result(BAD)).length).toBeGreaterThan(0);
    expect(findingsFor(result(''))).toEqual([]);
  });

  it('sorts most severe first without mutating the input', () => {
    const input = [f('info', 'a'), f('error', 'b'), f('warn', 'c'), f('error', 'd')];
    expect(sortFindings(input).map((x) => x.rule)).toEqual(['b', 'd', 'c', 'a']);
    expect(input[0]?.rule).toBe('a');
  });

  it('filters by level', () => {
    const all = [f('info'), f('warn'), f('error')];
    expect(failingFindings(all, 'error')).toHaveLength(1);
    expect(failingFindings(all, 'warn')).toHaveLength(2);
    expect(failingFindings([f('info')], 'warn')).toEqual([]);
  });

  it('summarizes with singular and plural words', () => {
    expect(summarizeFindings([])).toBe('no findings');
    expect(summarizeFindings([f('error')])).toBe('1 error');
    expect(summarizeFindings([f('error'), f('error'), f('warn'), f('info'), f('info')])).toBe(
      '2 errors, 1 warning, 2 notes',
    );
  });
});

describe('inspect: findings section', () => {
  it('lists real findings, linked to their part', () => {
    const html = inspect(result(BAD));
    expect(html).toContain('<h2>Findings</h2>');
    expect(html).toContain('no-flex-grid-layout');
    expect(html).toContain('href="#part-0"');
  });

  it('shows a clean bill when nothing is found', () => {
    expect(inspect(result(GOOD), { findings: [] })).toContain('<strong>No findings</strong>');
  });

  it('shows nothing for a render with no document', () => {
    expect(inspect(result(''))).not.toContain('<h2>Findings</h2>');
  });

  it('renders supplied findings, escaped, with optional fields', () => {
    const html = inspect(result(GOOD), {
      findings: [
        {
          rule: '<r>',
          severity: 'warn',
          partId: 'main',
          message: '<b>bad</b>',
          fix: 'do <this>',
          clients: ['gmail', 'yahoo'],
          excerpt: '<img src=x>',
        },
        { rule: 'orphan', severity: 'info', partId: 'gone', message: 'x' },
        { rule: 'global', severity: 'error', message: 'y' },
      ],
    });
    expect(html).toContain('&lt;r&gt;');
    expect(html).not.toContain('<b>bad</b>');
    expect(html).toContain('Fix: do &lt;this&gt;');
    expect(html).toContain('Affects: gmail, yahoo');
    expect(html).toContain('<code class="ex">&lt;img src=x&gt;</code>');
    expect(html).toContain('<span class="meta">gone</span>');
    expect(html).toContain('1 error, 1 warning, 1 note');
    expect(html.indexOf('global')).toBeLessThan(html.indexOf('orphan'));
  });

  it('omits empty clients', () => {
    const html = inspect(result(GOOD), { findings: [{ ...f('warn'), clients: [] }] });
    expect(html).not.toContain('Affects:');
  });
});

describe('traceJson findings', () => {
  it('includes the findings, and an empty list without a document', () => {
    expect(traceJson(result(BAD)).findings.length).toBeGreaterThan(0);
    expect(traceJson(result('')).findings).toEqual([]);
  });
});

describe('--fail-on', () => {
  it('parses and validates the flag', () => {
    expect(parseArgs(['inspect', 'a.mjs', '--fail-on', 'warn'])).toMatchObject({ failOn: 'warn' });
    expect(parseArgs(['inspect', 'a.mjs', '--fail-on=error'])).toMatchObject({ failOn: 'error' });
    expect(parseArgs(['inspect', 'a.mjs'])).not.toHaveProperty('failOn');
    expect(parseArgs(['inspect', 'a.mjs', '--fail-on', 'info'])).toEqual({
      kind: 'error',
      message: 'Invalid --fail-on "info". Use error or warn.',
    });
    expect(parseArgs(['dev', 'a.mjs', '--fail-on', 'warn']).kind).toBe('error');
  });

  async function run(html: string, failOn?: 'error' | 'warn') {
    const lines: string[] = [];
    const outcome: Outcome = { kind: 'result', result: result(html) } as Outcome;
    const code = await inspectCommand(
      'm.mjs',
      'o.html',
      {
        render: async () => outcome,
        write: async () => undefined,
        log: (line) => void lines.push(line),
      },
      undefined,
      failOn,
    );
    return { code, lines };
  }

  it('does not fail on findings by default, but reports them', async () => {
    const { code, lines } = await run(BAD);
    expect(code).toBe(0);
    expect(lines.some((line) => line.startsWith('Email checks: '))).toBe(true);
  });

  it('fails when findings reach the level', async () => {
    const { code, lines } = await run(BAD, 'error');
    expect(code).toBe(1);
    expect(lines).toContain('Failing because of --fail-on error.');
  });

  it('passes when nothing reaches the level', async () => {
    expect(findingsFor(result(GOOD)).some((x) => x.severity !== 'info')).toBe(false);
    expect((await run(GOOD, 'warn')).code).toBe(0);
  });

  it('keeps exit 1 for a broken render and skips the checks', async () => {
    const broken = { ...result(BAD), ok: false };
    const code = await inspectCommand(
      'm.mjs',
      'o.html',
      {
        render: async () => ({ kind: 'result', result: broken }) as Outcome,
        write: async () => undefined,
        log: () => undefined,
      },
      undefined,
      'warn',
    );
    expect(code).toBe(1);
  });
});
