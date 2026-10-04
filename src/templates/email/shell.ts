import { document } from '../document/document';
import { hasSlot, slot } from '../../runtime/render';
import type { RenderContext, TemplatePart } from '../../runtime/types';
import type { EmailProps } from './types';

const SHELL_PARTS = new Set(['head', 'main', 'footer']);

function readPart(parts: Readonly<Record<string, string>>, id: string): string {
  const html = parts[id];
  if (typeof html !== 'string') {
    throw new TypeError(`email shell is missing part "${id}"`);
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

/** Place custom part HTML inside `<body>`, after `main` and before `footer`. */
export function composeEmail(parts: Readonly<Record<string, string>>): string {
  // Read the shell before custom ids. Key order is the part list.
  const headHtml = readPart(parts, 'head');
  const mainPiece = readPart(parts, 'main');
  const extraIds = Object.keys(parts).filter((id) => !SHELL_PARTS.has(id));
  const extraHtml = extraIds.map((id) => readPart(parts, id)).join('\n');
  const footerHtml = readPart(parts, 'footer');
  const mainHtml = extraIds.length > 0 ? `${mainPiece}\n${extraHtml}` : mainPiece;
  return document({ headHtml, mainHtml, footerHtml });
}
