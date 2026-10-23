/// <reference types="node" />
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderEmail } from '../templates/email/email';
import type { EmailProps, EmailTemplate } from '../templates/email/types';
import type { PartTrace, RenderResult, Template } from '../runtime/types';
import type { RenderOptions } from '@llazyemail/render-template';

/**
 * What one render of a user's module came to. It is plain data, so it can
 * cross the process boundary as JSON.
 */
export type Outcome =
  | { kind: 'result'; result: RenderResult }
  | {
      kind: 'thrown';
      message: string;
      templateId: string;
      partId: string;
      trace: readonly PartTrace[];
    }
  | { kind: 'crash'; message: string; detail?: string };

interface ModuleEntry {
  template?: EmailTemplate | Template<EmailProps>;
  props?: EmailProps;
  options?: RenderOptions<EmailProps>;
}

export function crash(message: string, detail?: string): Outcome {
  return detail
    ? { kind: 'crash', message, detail: detail.slice(0, 4000) }
    : { kind: 'crash', message };
}

/** A `RenderError` from any copy of the package. `instanceof` fails across copies, so check the shape. */
function isRenderError(
  error: unknown,
): error is Error & { templateId: string; partId: string; trace: readonly PartTrace[] } {
  return (
    error instanceof Error &&
    error.name === 'RenderError' &&
    typeof (error as { templateId?: unknown }).templateId === 'string' &&
    typeof (error as { partId?: unknown }).partId === 'string' &&
    Array.isArray((error as { trace?: unknown }).trace)
  );
}

/**
 * Load a module and render what it exports: `template`, plus optional
 * `props` and `options`. A default export with those keys also works. The
 * default error mode is `collect`, so a broken part still shows every other
 * part. Set `options.onError` in the module to change that.
 */
export async function runModule(file: string): Promise<Outcome> {
  try {
    const loaded = (await import(pathToFileURL(resolve(file)).href)) as Record<string, unknown>;
    const entry = ('template' in loaded ? loaded : (loaded['default'] ?? {})) as ModuleEntry;
    if (!entry.template) {
      return crash(
        `${file} does not export a template. Add: export const template = defineEmailTemplate({ ... })`,
      );
    }
    const result = renderEmail(entry.template, entry.props ?? {}, {
      onError: 'collect',
      ...entry.options,
    });
    return { kind: 'result', result };
  } catch (error) {
    if (isRenderError(error)) {
      return {
        kind: 'thrown',
        message: error.message,
        templateId: error.templateId,
        partId: error.partId,
        trace: error.trace,
      };
    }
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
    return crash(error instanceof Error ? error.message : String(error), detail);
  }
}
