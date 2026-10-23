import { RenderError } from '@llazyemail/render-template';
import { diffRenders } from '../inspect/diff';
import { inspect } from '../inspect/inspect';
import { STYLES } from '../inspect/styles';
import { fromError } from '../runtime/result';
import type { RenderResult } from '../runtime/types';
import { escapeHtml } from '../utils/escape';
import type { Outcome } from './outcome';

type Crash = Extract<Outcome, { kind: 'crash' }>;

/** The part of an outcome the inspector can show. A crash has no render to show. */
export function toInspectable(outcome: Outcome): RenderResult | RenderError | undefined {
  if (outcome.kind === 'result') return outcome.result;
  if (outcome.kind === 'thrown') {
    return new RenderError(outcome.message, {
      templateId: outcome.templateId,
      partId: outcome.partId,
      trace: outcome.trace,
    });
  }
  return undefined;
}

function asResult(value: RenderResult | RenderError): RenderResult {
  return value instanceof RenderError ? fromError(value) : value;
}

/** True when two renders differ in their document or in any part. */
export function renderChanged(
  a: RenderResult | RenderError,
  b: RenderResult | RenderError,
): boolean {
  return diffRenders(asResult(a), asResult(b)).changed;
}

/** The page for a render that could not even start, such as a syntax error in the module. */
export function crashPage(outcome: Crash): string {
  const detail = outcome.detail ? `<pre>${escapeHtml(outcome.detail)}</pre>` : '';
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light dark">',
    '<title>Render failed</title>',
    `<style>${STYLES}</style>`,
    '</head>',
    '<body>',
    '<main class="page">',
    '<header class="head"><div><p class="eyebrow">Template module</p><h1>Could not render</h1></div><span class="verdict v-bad">CRASHED</span></header>',
    `<div class="banner" role="alert"><strong>${escapeHtml(outcome.message)}</strong>${detail}</div>`,
    '<p class="note">Fix the module and save the file. This page reloads on its own.</p>',
    '</main>',
    '</body>',
    '</html>',
  ].join('\n');
}

/** The inspector for an outcome, or the crash page when there is nothing to inspect. */
export function outcomePage(outcome: Outcome, compareTo?: RenderResult | RenderError): string {
  const inspectable = toInspectable(outcome);
  if (!inspectable) return crashPage(outcome as Crash);
  return inspect(inspectable, compareTo ? { compareTo } : {});
}
