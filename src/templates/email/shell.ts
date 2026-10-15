import { displayErrors } from '../../runtime/errors';
import { document } from '../document/document';
import type { DocumentShellOptions } from '../document/document';
import { hasSlot, slot } from '../../runtime/render';
import type { RenderContext, TemplatePart } from '../../runtime/types';
import type { EmailProps } from './types';

const SHELL_PARTS = new Set(['head', 'main', 'footer']);

function readPart(parts: Readonly<Record<string, string>>, id: string): string {
  const html = parts[id];
  if (typeof html !== 'string') {
    throw displayErrors.shellPartMissing(id);
  }
  return html;
}

/** Built-in shell step. A slot with the same id replaces the fragment. */
export function shellPart(
  id: string,
  render: (ctx: RenderContext<EmailProps>) => string,
): TemplatePart<EmailProps> {
  return {
    id,
    render: (ctx) => (hasSlot(ctx, id) ? slot(ctx, id) : render(ctx)),
  };
}

/**
 * Merge template-level shell defaults with per-render props.
 * Props win when both supply a value.
 */
export function mergeShell(
  defaults: DocumentShellOptions | undefined,
  props: EmailProps,
): DocumentShellOptions {
  const merged: DocumentShellOptions = { ...defaults };
  if (props.doctype !== undefined) merged.doctype = props.doctype;
  if (props.lang !== undefined) merged.lang = props.lang;
  if (props.htmlAttributes !== undefined) merged.htmlAttributes = props.htmlAttributes;
  if (props.bodyAttributes !== undefined) merged.bodyAttributes = props.bodyAttributes;
  return merged;
}

/** Place custom part HTML inside `<body>`, after `main` and before `footer`. */
export function composeEmail(
  parts: Readonly<Record<string, string>>,
  props: EmailProps = {},
  shellDefaults?: DocumentShellOptions,
): string {
  // Read the shell before custom ids. Key order is the part list.
  const headHtml = readPart(parts, 'head');
  const mainPiece = readPart(parts, 'main');
  const extraIds = Object.keys(parts).filter((id) => !SHELL_PARTS.has(id));
  const extraHtml = extraIds.map((id) => readPart(parts, id)).join('\n');
  const footerHtml = readPart(parts, 'footer');
  const mainHtml = extraIds.length > 0 ? `${mainPiece}\n${extraHtml}` : mainPiece;

  const shell = mergeShell(shellDefaults, props);

  return document({
    headHtml,
    mainHtml,
    footerHtml,
    ...(shell.doctype !== undefined ? { doctype: shell.doctype } : {}),
    ...(shell.lang !== undefined ? { lang: shell.lang } : {}),
    ...(shell.htmlAttributes !== undefined ? { htmlAttributes: shell.htmlAttributes } : {}),
    ...(shell.bodyAttributes !== undefined ? { bodyAttributes: shell.bodyAttributes } : {}),
  });
}
