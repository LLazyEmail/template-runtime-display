import { describe, expect, it } from 'vitest';
import {
  defineTemplate,
  explain,
  hasSlot,
  renderMany,
  renderTemplate,
  DisplayError,
  DisplayErrorCode,
  RenderError,
  slot,
} from '../src/index';
import type { RenderContext, Template, TemplatePart } from '../src/index';

function template(
  parts: readonly TemplatePart<Record<string, string>>[],
  compose?: Template<Record<string, string>>['compose'],
  id = 'demo',
): Template<Record<string, string>> {
  return defineTemplate({
    id,
    parts,
    compose: compose ?? ((rendered) => parts.map((part) => rendered[part.id] ?? '').join('|')),
  });
}

describe('defineTemplate', () => {
  it('rejects an empty template id', () => {
    expect(() => template([], undefined, '')).toThrow(RenderError);
    expect(() => template([], undefined, '')).toThrow(/template id is empty/);
  });

  it('copies and freezes the part list', () => {
    const parts: TemplatePart<Record<string, string>>[] = [{ id: 'a', render: () => 'A' }];
    const defined = defineTemplate({
      id: 'demo',
      parts,
      compose: (rendered) => rendered['a'] ?? '',
    });
    parts.push({ id: 'b', render: () => 'B' });
    const result = renderTemplate(defined, {});
    expect(Object.isFrozen(defined)).toBe(true);
    expect(Object.isFrozen(defined.parts)).toBe(true);
    expect(result.html).toBe('A');
    expect(result.parts.map((part) => part.id)).toEqual(['a']);
  });

  it('rejects an empty part id, a reserved id, a duplicate id, and a missing compose', () => {
    expect(() => template([{ id: '', render: () => '' }])).toThrow(/empty part id/);
    expect(() => template([{ id: 'compose', render: () => '' }])).toThrow(/reserved/);
    expect(() =>
      template([
        { id: 'a', render: () => 'A' },
        { id: 'a', render: () => 'B' },
      ]),
    ).toThrow(/duplicate part id "a"/);
    expect(() =>
      renderTemplate(
        {
          id: 'bare',
          parts: [],
          compose: undefined as unknown as Template<Record<string, string>>['compose'],
        },
        {},
      ),
    ).toThrow(/missing compose/);
  });
});

describe('renderTemplate', () => {
  it('renders parts in order and records an empty part', () => {
    const result = renderTemplate(
      template([
        { id: 'a', render: (ctx) => ctx.templateId },
        { id: 'b', render: () => undefined as unknown as string },
      ]),
      {},
    );
    expect(result.ok).toBe(true);
    expect(result.html).toBe('demo|');
    expect(result.parts.map((part) => part.status)).toEqual(['ok', 'empty']);
    expect(result.parts[0]?.html).toBe('demo');
    expect(result.parts[0]?.ms).toBeGreaterThanOrEqual(0);
    expect(Object.isFrozen(result.parts)).toBe(true);
    expect(explain(result)).toContain('demo: ok');
    expect(explain(result)).toContain('b empty');
  });

  it('passes the same props object into every part', () => {
    const props = { label: 'A' };
    let seen: Record<string, string> | undefined;
    renderTemplate(
      template([
        {
          id: 'a',
          render: (ctx) => {
            seen = ctx.props;
            return ctx.props['label'] ?? '';
          },
        },
      ]),
      props,
    );
    expect(seen).toBe(props);
    expect(seen?.['label']).toBe('A');
  });

  it('throws RenderError and skips parts after the broken one', () => {
    let later = 0;
    try {
      renderTemplate(
        template([
          { id: 'a', render: () => 'A' },
          {
            id: 'bad',
            render: () => {
              throw new Error('nope');
            },
          },
          {
            id: 'later',
            render: () => {
              later += 1;
              return 'L';
            },
          },
        ]),
        {},
        { onError: 'throw' },
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RenderError);
      const failure = error as RenderError;
      expect(failure.templateId).toBe('demo');
      expect(failure.partId).toBe('bad');
      expect(failure.cause).toBeInstanceOf(Error);
      expect(failure.trace.map((part) => [part.id, part.status])).toEqual([
        ['a', 'ok'],
        ['bad', 'error'],
        ['later', 'skipped'],
      ]);
      expect(Object.isFrozen(failure.trace)).toBe(true);
      expect(Object.isFrozen(failure.trace[1]?.error)).toBe(true);
      expect(explain(failure)).toContain('failed at part');
      expect(explain(failure)).toContain('bad error');
      expect(explain(failure)).toContain('later skipped');
    }
    expect(later).toBe(0);
  });

  it('collects a non-Error throw and still renders the following part', () => {
    const result = renderTemplate(
      template([
        {
          id: 'bad',
          render: () => {
            throw 'boom';
          },
        },
        { id: 'after', render: () => 'AFTER' },
      ]),
      {},
      { onError: 'collect' },
    );
    expect(result.ok).toBe(false);
    expect(result.html).toBe('|AFTER');
    expect(result.parts[0]?.error).toEqual({ name: 'Error', message: 'boom' });
    expect(result.parts[1]?.status).toBe('ok');
  });

  it('reports a non-string part return', () => {
    const result = renderTemplate(
      template([{ id: 'bad', render: () => 1 as unknown as string }]),
      {},
      {
        onError: 'collect',
      },
    );
    expect(result.parts[0]?.error?.message).toContain('returned number');
  });

  it('collects a compose failure and throws one in throw mode', () => {
    const broken = template([{ id: 'a', render: () => 'A' }], () => 1 as unknown as string);
    const collected = renderTemplate(broken, {}, { onError: 'collect' });
    expect(collected.ok).toBe(false);
    expect(collected.html).toBe('');
    expect(collected.composeError?.message).toContain('returned number');
    expect(explain(collected)).toContain('compose error');

    expect(() =>
      renderTemplate(
        template([{ id: 'a', render: () => 'A' }], () => {
          throw new Error('compose broke');
        }),
        {},
      ),
    ).toThrow(/failed at part "compose"/);
  });
});

describe('slots', () => {
  it('reads a string, a function, a missing slot, and an empty function result', () => {
    const ctx: RenderContext<Record<string, string>> = {
      templateId: 'demo',
      props: {},
      slots: Object.freeze({
        text: 'TEXT',
        fn: () => 'FN',
        empty: () => undefined as unknown as string,
      }),
    };
    expect(hasSlot(ctx, 'text')).toBe(true);
    expect(hasSlot(ctx, 'missing')).toBe(false);
    expect(slot(ctx, 'text')).toBe('TEXT');
    expect(slot(ctx, 'fn')).toBe('FN');
    expect(slot(ctx, 'empty')).toBe('');
    expect(slot(ctx, 'missing')).toBe('');
  });

  it('rejects a slot that is not a string or function, and a function that returns a non-string', () => {
    const ctx: RenderContext<Record<string, string>> = {
      templateId: 'demo',
      props: {},
      slots: {
        bad: 1 as unknown as string,
        nil: null as unknown as string,
        num: () => 2 as unknown as string,
      },
    };
    expect(() => slot(ctx, 'bad')).toThrow(DisplayError);
    expect(() => slot(ctx, 'bad')).toThrow(/slot "bad" is number/);
    expect(() => slot(ctx, 'nil')).toThrow(/slot "nil" is null/);
    expect(() => slot(ctx, 'num')).toThrow(/slot "num" returned number/);
    try {
      slot(ctx, 'bad');
    } catch (error) {
      expect(error).toBeInstanceOf(DisplayError);
      expect((error as DisplayError).code).toBe(DisplayErrorCode.slotType);
      expect((error as DisplayError).name).toBe('DisplayError');
    }
    try {
      slot(ctx, 'num');
    } catch (error) {
      expect((error as DisplayError).code).toBe(DisplayErrorCode.slotReturn);
    }
  });
});

describe('renderMany', () => {
  it('renders each job on its own and keeps going when one is collected', () => {
    const okTemplate = template(
      [{ id: 'a', render: (ctx) => ctx.props['label'] ?? '' }],
      undefined,
      'ok',
    );
    const badTemplate = template(
      [
        {
          id: 'bad',
          render: () => {
            throw new Error('x');
          },
        },
      ],
      undefined,
      'bad',
    );
    const results = renderMany(
      [
        { template: okTemplate, props: { label: 'ONE' } },
        { template: badTemplate },
        { template: okTemplate, props: { label: 'TWO' }, slots: { unused: 'nope' } },
      ],
      { onError: 'collect' },
    );
    expect(results.map((result) => result.ok)).toEqual([true, false, true]);
    expect(results[0]?.html).toBe('ONE');
    expect(results[2]?.html).toBe('TWO');
    expect(results[0]?.html).not.toBe(results[2]?.html);
  });

  it('uses throw mode when no batch option is passed and does not run later jobs', () => {
    let later = 0;
    const badTemplate = template([
      {
        id: 'bad',
        render: () => {
          throw new Error('x');
        },
      },
    ]);
    const laterTemplate = template(
      [
        {
          id: 'later',
          render: () => {
            later += 1;
            return 'L';
          },
        },
      ],
      undefined,
      'later',
    );
    expect(() =>
      renderMany([{ template: badTemplate, props: { label: 'Z' } }, { template: laterTemplate }]),
    ).toThrow(RenderError);
    expect(later).toBe(0);
  });
});
