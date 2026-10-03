import { RenderError } from '@llazyemail/render-template';
import type {
  PartFailure,
  PartTrace,
  RenderContext,
  RenderResult,
  SlotValue,
  Template,
  TemplatePart,
} from './types';

export const RESERVED_PART_ID = 'compose';

export function finish<TProps>(
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

export function createContext<TProps>(
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

export function assertTemplate<TProps>(template: Template<TProps>): void {
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

export function assertPart<TProps>(
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

export function normalizeHtml(partId: string, value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'string') {
    throw new TypeError(`part "${partId}" returned ${typeof value}, expected a string`);
  }
  return value;
}

export function okTrace(id: string, html: string, ms: number): PartTrace {
  return {
    id,
    status: html === '' ? 'empty' : 'ok',
    html,
    chars: html.length,
    ms,
  };
}

export function skippedTrace(id: string): PartTrace {
  return { id, status: 'skipped', html: '', chars: 0, ms: 0 };
}

export function describeError(error: unknown): PartFailure {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: 'Error', message: String(error) };
}

/** Freeze the rows a caller may store while other templates keep rendering. */
export function publish(trace: PartTrace[]): readonly PartTrace[] {
  for (const part of trace) {
    if (part.error !== undefined) Object.freeze(part.error);
    Object.freeze(part);
  }
  return Object.freeze(trace);
}
