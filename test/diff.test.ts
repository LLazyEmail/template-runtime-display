import { describe, expect, it } from 'vitest';
import { diffRenders, formatDiff } from '../src/index';
import type { PartStatus, PartTrace, RenderResult } from '../src/index';
import { diffLines, trimContext } from '../src/inspect/diff';
import type { DiffLine } from '../src/inspect/diff';

function part(id: string, html: string, status: PartStatus = 'ok'): PartTrace {
  return { id, status, html, chars: html.length, ms: 0 };
}

function result(parts: PartTrace[], html?: string, templateId = 'demo'): RenderResult {
  return {
    templateId,
    ok: parts.every((p) => p.status !== 'error'),
    html: html ?? parts.map((p) => p.html).join('\n'),
    parts,
  };
}

function summarize(lines: readonly DiffLine[]): string[] {
  return lines.map(
    (line) => `${line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : '='}${line.text}`,
  );
}

describe('diffLines', () => {
  it('marks identical text as unchanged', () => {
    expect(summarize(diffLines('a\nb', 'a\nb'))).toEqual(['=a', '=b']);
  });

  it('reports pure additions and pure deletions', () => {
    expect(summarize(diffLines('a', 'a\nb'))).toEqual(['=a', '+b']);
    expect(summarize(diffLines('a\nb', 'a'))).toEqual(['=a', '-b']);
  });

  it('keeps the shared head and tail and diffs only the middle', () => {
    expect(summarize(diffLines('head\nold\ntail', 'head\nnew\ntail'))).toEqual([
      '=head',
      '-old',
      '+new',
      '=tail',
    ]);
  });

  it('finds the common line inside the middle block', () => {
    expect(summarize(diffLines('a\nb\nc\nd', 'a\nx\nc\ny'))).toEqual([
      '=a',
      '-b',
      '+x',
      '=c',
      '-d',
      '+y',
    ]);
  });

  it('takes an addition before a shared line when that keeps more in common', () => {
    expect(summarize(diffLines('q', 'p\nq'))).toEqual(['+p', '=q']);
  });

  it('keeps deleting after the other side is used up', () => {
    expect(summarize(diffLines('q\nz', 'p\nq'))).toEqual(['+p', '=q', '-z']);
  });

  it('keeps adding after the other side is used up', () => {
    expect(summarize(diffLines('x\ny', 'y\nz'))).toEqual(['-x', '=y', '+z']);
  });

  it('replaces the whole middle block when the search would be too large', () => {
    const before = Array.from({ length: 600 }, (_, i) => `a${i}`).join('\n');
    const after = Array.from({ length: 600 }, (_, i) => `b${i}`).join('\n');
    const lines = diffLines(before, after);
    expect(lines).toHaveLength(1200);
    expect(lines.slice(0, 600).every((line) => line.kind === 'del')).toBe(true);
    expect(lines.slice(600).every((line) => line.kind === 'add')).toBe(true);
  });

  it('treats an empty side as all additions or all deletions', () => {
    expect(summarize(diffLines('', 'a'))).toEqual(['-', '+a']);
    expect(summarize(diffLines('a', ''))).toEqual(['-a', '+']);
  });
});

describe('diffRenders', () => {
  it('reports no change for identical renders', () => {
    const before = result([part('a', '<p>A</p>'), part('b', '<p>B</p>')]);
    const diff = diffRenders(before, result([part('a', '<p>A</p>'), part('b', '<p>B</p>')]));
    expect(diff.changed).toBe(false);
    expect(diff.parts.map((p) => p.change)).toEqual(['unchanged', 'unchanged']);
    expect(diff.parts.every((p) => p.lines.length === 0 && p.charsDelta === 0)).toBe(true);
    expect(diff.lines.every((line) => line.kind === 'same')).toBe(true);
  });

  it('names the part whose HTML changed and by how many characters', () => {
    const diff = diffRenders(
      result([part('a', '<p>A</p>'), part('b', '<p>B</p>')]),
      result([part('a', '<p>A</p>'), part('b', '<p>Bee</p>')]),
    );
    const changed = diff.parts.filter((p) => p.change !== 'unchanged');
    expect(diff.changed).toBe(true);
    expect(changed.map((p) => p.id)).toEqual(['b']);
    expect(changed[0]?.change).toBe('changed');
    expect(changed[0]?.charsDelta).toBe(2);
    expect(summarize(changed[0]?.lines ?? [])).toEqual(['-<p>B</p>', '+<p>Bee</p>']);
    expect(changed[0]?.statusBefore).toBe('ok');
    expect(changed[0]?.statusAfter).toBe('ok');
  });

  it('counts a status change as a change even when the HTML is the same', () => {
    const diff = diffRenders(
      result([part('a', '', 'error')], ''),
      result([part('a', '', 'empty')], ''),
    );
    expect(diff.changed).toBe(true);
    expect(diff.parts[0]).toMatchObject({
      change: 'changed',
      statusBefore: 'error',
      statusAfter: 'empty',
      charsDelta: 0,
    });
  });

  it('reports added and removed parts, counting from zero', () => {
    const diff = diffRenders(
      result([part('keep', 'K'), part('gone', 'gone!')]),
      result([part('keep', 'K'), part('fresh', 'new')]),
    );
    const byId = Object.fromEntries(diff.parts.map((p) => [p.id, p]));
    expect(byId['gone']).toMatchObject({ change: 'removed', charsDelta: -5 });
    expect(byId['gone']?.statusAfter).toBeUndefined();
    expect(byId['gone']?.statusBefore).toBe('ok');
    expect(byId['fresh']).toMatchObject({ change: 'added', charsDelta: 3 });
    expect(byId['fresh']?.statusBefore).toBeUndefined();
    expect(byId['fresh']?.statusAfter).toBe('ok');
    expect(summarize(byId['fresh']?.lines ?? [])).toEqual(['-', '+new']);
  });

  it('matches parts by id, so reordering alone is not a part change', () => {
    const diff = diffRenders(
      result([part('a', 'A'), part('b', 'B')], 'same'),
      result([part('b', 'B'), part('a', 'A')], 'same'),
    );
    expect(diff.changed).toBe(false);
  });

  it('flags a changed document even when every part is the same', () => {
    const parts = [part('a', 'A')];
    const diff = diffRenders(result(parts, '<main>one</main>'), result(parts, '<main>two</main>'));
    expect(diff.changed).toBe(true);
    expect(diff.parts.every((p) => p.change === 'unchanged')).toBe(true);
  });

  it('carries both template ids', () => {
    const diff = diffRenders(result([], '', 'before'), result([], '', 'after'));
    expect([diff.templateBefore, diff.templateAfter]).toEqual(['before', 'after']);
  });
});

describe('trimContext', () => {
  const lines = (...kinds: string[]): DiffLine[] =>
    kinds.map((kind, i) => ({ kind: kind as DiffLine['kind'], text: `l${i}` }));

  it('collapses an unchanged document to one marker', () => {
    expect(summarize(trimContext(lines('same', 'same', 'same')))).toEqual(['=…']);
  });

  it('keeps context around a change and collapses each gap once', () => {
    const out = trimContext(
      lines('same', 'same', 'same', 'same', 'add', 'same', 'same', 'same', 'same', 'same'),
      1,
    );
    expect(summarize(out)).toEqual(['=…', '=l3', '+l4', '=l5', '=…']);
  });

  it('stops at the edges of the document', () => {
    expect(summarize(trimContext(lines('del', 'same', 'same', 'same', 'add'), 1))).toEqual([
      '-l0',
      '=l1',
      '=…',
      '=l3',
      '+l4',
    ]);
  });

  it('uses two lines of context by default and none when asked', () => {
    const six = lines('same', 'same', 'same', 'add', 'same', 'same', 'same');
    expect(summarize(trimContext(six))).toEqual(['=…', '=l1', '=l2', '+l3', '=l4', '=l5', '=…']);
    expect(summarize(trimContext(six, 0))).toEqual(['=…', '+l3', '=…']);
  });
});

describe('formatDiff', () => {
  it('says so when nothing changed', () => {
    const same = result([part('a', 'A')]);
    expect(formatDiff(diffRenders(same, same))).toBe('demo: no changes');
  });

  it('lists the changed parts, then the changed lines', () => {
    const text = formatDiff(
      diffRenders(
        result([part('a', 'A'), part('b', 'old text')], 'top\nold text\nbottom'),
        result([part('a', 'A'), part('b', 'new')], 'top\nnew\nbottom'),
      ),
    );
    expect(text).toBe(
      ['demo: changed', '  b changed (-5 chars)', '  top', '- old text', '+ new', '  bottom'].join(
        '\n',
      ),
    );
  });

  it('prefixes growth with a plus sign and skips unchanged parts', () => {
    const text = formatDiff(
      diffRenders(
        result([part('a', 'A'), part('b', '')]),
        result([part('a', 'A'), part('b', 'xy')]),
      ),
    );
    expect(text).toContain('  b changed (+2 chars)');
    expect(text).not.toContain('  a ');
  });
});

it('treats a missing html field as empty when a part is added', () => {
  const before = result([]);
  const after = result([
    { id: 'fresh', status: 'ok', html: undefined as unknown as string, chars: 0, ms: 0 },
  ]);
  const diff = diffRenders(before, after);
  expect(diff.parts[0]).toMatchObject({ id: 'fresh', change: 'added' });
});
