export type Scheme = 'light' | 'dark';

/**
 * Pin the color scheme of a document for the preview. A frame's own scheme
 * follows the viewer's system setting, so without this the "Light" preview
 * turns dark on a dark system. The style goes right after `<head>`, or after
 * the doctype when there is no head (a doctype must stay first, or the page
 * drops into quirks mode), or at the start of a fragment.
 *
 * This sets the default canvas and text colors, like a client that supports
 * `color-scheme`. It does not run the document's own `prefers-color-scheme`
 * rules, which follow the system setting.
 */
export function withScheme(html: string, scheme: Scheme): string {
  const style = `<style>:root{color-scheme:${scheme}}</style>`;
  const after = /<head\b[^>]*>/i.exec(html) ?? /^\s*<!doctype[^>]*>/i.exec(html);
  if (!after) return `${style}${html}`;
  const at = after.index + after[0].length;
  return `${html.slice(0, at)}${style}${html.slice(at)}`;
}
