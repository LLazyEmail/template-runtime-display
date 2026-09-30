import type {
  PartFailure,
  PartTrace,
  RenderContext,
  RenderJob,
  RenderOptions,
  RenderResult,
  SlotValue,
  Template,
  TemplatePart,
} from './types';

const RESERVED_PART_ID = 'compose';

/** Thrown when a template definition is invalid or a part breaks in `throw` mode. */
export class RenderError extends Error {
  readonly templateId: string;
  readonly partId: string;
  readonly trace: readonly PartTrace[];

  constructor(
    message: string,
    details: {
      templateId: string;
      partId: string;
      trace: readonly PartTrace[];
      cause?: unknown;
    },
  ) {
    super(message, details.cause === undefined ? undefined : { cause: details.cause });
    this.name = 'RenderError';
    this.templateId = details.templateId;
    this.partId = details.partId;
    this.trace = details.trace;
  }
}

/**
 * Validate, copy, and freeze a template. Later edits to the caller's part
 * array do not change a template that has already been defined.
 */
export function defineTemplate<TProps>(template: Template<TProps>): Template<TProps> {
  assertTemplate(template);
  return Object.freeze({
    id: template.id,
    parts: Object.freeze(
      template.parts.map((part) => Object.freeze({ id: part.id, render: part.render })),
    ),
    compose: template.compose,
  });
}

/**
 * Render one template. The same template and props produce the same HTML.
 * The runtime keeps no state between calls.
 */
export function renderTemplate<TProps>(
  template: Template<TProps>,
  props: TProps,
  options: RenderOptions<TProps> = {},
): RenderResult {
  assertTemplate(template);
  const onError = options.onError ?? 'throw';
  const ctx = createContext(template.id, props, options.slots);
  const trace: PartTrace[] = [];
  const rendered: Record<string, string> = {};
  let ok = true;

  for (const [index, part] of template.parts.entries()) {
    const started = Date.now();
    try {
      const html = normalizeHtml(part.id, part.render(ctx));
      rendered[part.id] = html;
      trace.push(okTrace(part.id, html, Date.now() - started));
    } catch (error) {
      ok = false;
      const failure = describeError(error);
      rendered[part.id] = '';
      trace.push({
        id: part.id,
        status: 'error',
        html: '',
        chars: 0,
        ms: Date.now() - started,
        error: failure,
      });
      if (onError === 'throw') {
        for (const later of template.parts.slice(index + 1)) {
          trace.push(skippedTrace(later.id));
        }
        throw new RenderError(
          `template "${template.id}" failed at part "${part.id}": ${failure.message}`,
          {
            templateId: template.id,
            partId: part.id,
            trace: publish(trace),
            cause: error,
          },
        );
      }
    }
  }

  return finish(template, ctx, rendered, trace, ok, onError);
}

/** Render many templates. Use `onError: 'collect'` so one broken template does not stop the batch. */
export function renderMany<TProps>(
  jobs: readonly RenderJob<TProps>[],
  options?: Pick<RenderOptions<TProps>, 'onError'>,
): RenderResult[] {
  return jobs.map((job) => {
    const next: RenderOptions<TProps> = {};
    if (options?.onError !== undefined) next.onError = options.onError;
    if (job.slots !== undefined) next.slots = job.slots;
    const props = job.props === undefined ? ({} as TProps) : job.props;
    return renderTemplate(job.template, props, next);
  });
}

/** Read a slot. A missing slot is `''`. A function slot is called with the same context. */
export function slot<TProps>(ctx: RenderContext<TProps>, id: string): string {
  if (!hasSlot(ctx, id)) return '';
  const value = ctx.slots[id];
  if (typeof value === 'function') {
    const html = value(ctx);
    if (html == null) return '';
    if (typeof html !== 'string') {
      throw new TypeError(`slot "${id}" returned ${typeof html}, expected a string`);
    }
    return html;
  }
  if (typeof value === 'string') return value;
  throw new TypeError(
    `slot "${id}" is ${value === null ? 'null' : typeof value}, expected a string or function`,
  );
}

/** True when the caller passed this slot, including an empty string. */
export function hasSlot<TProps>(ctx: RenderContext<TProps>, id: string): boolean {
  return Object.hasOwn(ctx.slots, id);
}

function finish<TProps>(
  template: Template<TProps>,
  ctx: RenderContext<TProps>,
  rendered: Record<string, string>,
  trace: PartTrace[],
  ok: boolean,
  onError: 'throw' | 'collect',
): RenderResult {
  try {
    const html = template.compose(rendered, ctx);
    if (typeof html !== 'string') {
      throw new TypeError(`compose returned ${typeof html}, expected a string`);
    }
    return { templateId: template.id, ok, html, parts: publish(trace) };
  } catch (error) {
    const failure = describeError(error);
    if (onError === 'collect') {
      return {
        templateId: template.id,
        ok: false,
        html: '',
        parts: publish(trace),
        composeError: failure,
      };
    }
    throw new RenderError(
      `template "${template.id}" failed at part "compose": ${failure.message}`,
      {
        templateId: template.id,
        partId: RESERVED_PART_ID,
        trace: publish(trace),
        cause: error,
      },
    );
  }
}

function createContext<TProps>(
  templateId: string,
  props: TProps,
  slots: Readonly<Record<string, SlotValue<TProps>>> | undefined,
): RenderContext<TProps> {
  return {
    templateId,
    props,
    slots: Object.freeze({ ...(slots ?? {}) }),
  };
}

function assertTemplate<TProps>(template: Template<TProps>): void {
  if (template.id === '') {
    throw new RenderError('template id is empty', {
      templateId: '',
      partId: 'template',
      trace: [],
    });
  }
  const seen = new Set<string>();
  for (const part of template.parts) {
    assertPart(template.id, part, seen);
  }
  if (typeof template.compose !== 'function') {
    throw new RenderError(`template "${template.id}" is missing compose`, {
      templateId: template.id,
      partId: 'template',
      trace: [],
    });
  }
}

function assertPart<TProps>(
  templateId: string,
  part: TemplatePart<TProps>,
  seen: Set<string>,
): void {
  if (part.id === '') {
    throw new RenderError(`template "${templateId}" has an empty part id`, {
      templateId,
      partId: 'template',
      trace: [],
    });
  }
  if (part.id === RESERVED_PART_ID) {
    throw new RenderError(`part id "${RESERVED_PART_ID}" is reserved`, {
      templateId,
      partId: 'template',
      trace: [],
    });
  }
  if (seen.has(part.id)) {
    throw new RenderError(`duplicate part id "${part.id}"`, {
      templateId,
      partId: 'template',
      trace: [],
    });
  }
  seen.add(part.id);
}

function normalizeHtml(partId: string, value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'string') {
    throw new TypeError(`part "${partId}" returned ${typeof value}, expected a string`);
  }
  return value;
}

function okTrace(id: string, html: string, ms: number): PartTrace {
  return {
    id,
    status: html === '' ? 'empty' : 'ok',
    html,
    chars: html.length,
    ms,
  };
}

function skippedTrace(id: string): PartTrace {
  return { id, status: 'skipped', html: '', chars: 0, ms: 0 };
}

function describeError(error: unknown): PartFailure {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: 'Error', message: String(error) };
}

/** Freeze the rows a caller may store while other templates keep rendering. */
function publish(trace: PartTrace[]): readonly PartTrace[] {
  for (const part of trace) {
    if (part.error !== undefined) Object.freeze(part.error);
    Object.freeze(part);
  }
  return Object.freeze(trace);
}
