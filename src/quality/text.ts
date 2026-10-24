export interface TextOptions {
  /** Wrap lines at this many columns. Default 78. Use 0 to leave lines unwrapped. */
  width?: number;
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  bull: '•',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body.startsWith('#')) {
      const code = /^#x/i.test(body) ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Remove tags with a single linear scan. */
function stripTags(html: string): string {
  let out = '';
  let i = 0;
  while (i < html.length) {
    const open = html.indexOf('<', i);
    if (open === -1) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, open);
    const close = html.indexOf('>', open + 1);
    if (close === -1) {
      out += html.slice(open);
      break;
    }
    i = close + 1;
  }
  return out;
}

/** Drop HTML comments with a linear scan. */
function stripComments(html: string): string {
  let out = '';
  let i = 0;
  while (i < html.length) {
    const open = html.indexOf('<!--', i);
    if (open === -1) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, open);
    const close = html.indexOf('-->', open + 4);
    i = close === -1 ? html.length : close + 3;
  }
  return out;
}

/** Drop the contents of matching open/close tag pairs (head, style, script, …). */
function stripPaired(html: string, tag: string): string {
  const openRe = new RegExp(`<${tag}\\b`, 'gi');
  const close = `</${tag}>`;
  let out = '';
  let i = 0;
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(html)) !== null) {
    out += html.slice(i, match.index);
    const closeAt = html.toLowerCase().indexOf(close, match.index + match[0].length);
    if (closeAt === -1) {
      i = match.index;
      break;
    }
    i = closeAt + close.length;
    openRe.lastIndex = i;
  }
  out += html.slice(i);
  return out;
}

/** Drop elements whose opening tag contains `display:none`. */
function stripHidden(html: string): string {
  const tags = ['div', 'span', 'p', 'td', 'table', 'tr'];
  let out = html;
  for (const tag of tags) {
    const openRe = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
    let result = '';
    let i = 0;
    let match: RegExpExecArray | null;
    while ((match = openRe.exec(out)) !== null) {
      const open = match[0];
      if (!/display\s*:\s*none/i.test(open)) continue;
      result += out.slice(i, match.index);
      const close = `</${tag}>`;
      const closeAt = out.toLowerCase().indexOf(close, match.index + open.length);
      if (closeAt === -1) {
        i = match.index;
        break;
      }
      i = closeAt + close.length;
      openRe.lastIndex = i;
    }
    result += out.slice(i);
    out = result;
  }
  return out;
}

function attribute(tag: string, name: string): string | undefined {
  const found = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return found ? (found[1] ?? found[2] ?? found[3]) : undefined;
}

function wrapLine(line: string, width: number): string[] {
  if (width <= 0 || line.length <= width) return [line];
  const indent = line.startsWith('- ') ? '  ' : '';
  const lines: string[] = [];
  let current = '';
  for (const word of line.split(' ')) {
    if (current !== '' && current.length + 1 + word.length > width) {
      lines.push(current);
      current = indent + word;
    } else {
      current = current === '' ? word : `${current} ${word}`;
    }
  }
  lines.push(current);
  return lines;
}

function extractPreheader(html: string): string {
  const lower = html.toLowerCase();
  let search = 0;
  while (search < html.length) {
    const open = lower.indexOf('<span', search);
    if (open === -1) break;
    const close = html.indexOf('>', open);
    if (close === -1) break;
    const tag = html.slice(open, close + 1);
    if (/class\s*=\s*["'][^"']*\bpreheader\b/i.test(tag)) {
      const end = lower.indexOf('</span>', close);
      if (end === -1) return '';
      return decodeEntities(stripTags(html.slice(close + 1, end)));
    }
    search = close + 1;
  }
  return '';
}

/**
 * Turn an email's HTML into the plain-text alternative that goes in the
 * `text/plain` part. No DOM and no dependency: it reads the markup this
 * package generates (headings, paragraphs, lists, links, tables), not
 * arbitrary HTML.
 *
 * Headings become uppercase lines. Paragraphs are separated by a blank line.
 * Lists become `- item`. A link becomes `label (url)`, or just the URL when the
 * label is the URL. Images become `[alt]`. The hidden preheader is kept as the
 * first line. `<head>`, styles, scripts, comments and other `display:none`
 * blocks are dropped.
 */

function rewriteAnchors(html: string): string {
  const re = /<a\b([^>]*)>/gi;
  let out = '';
  let i = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    out += html.slice(i, match.index);
    const close = html.toLowerCase().indexOf('</a>', match.index + match[0].length);
    if (close === -1) {
      out += html.slice(match.index);
      break;
    }
    const attrs = match[1];
    const inner = html.slice(match.index + match[0].length, close);
    const label = decodeEntities(stripTags(inner)).trim();
    const href = (attribute(` ${attrs}`, 'href') ?? '').trim();
    let replacement: string;
    if (href === '' || href.startsWith('#') || /^javascript:/i.test(href)) replacement = label;
    else replacement = label === '' || label === href ? href : `${label} (${href})`;
    out += replacement;
    i = close + 4;
    re.lastIndex = i;
  }
  out += html.slice(i);
  return out;
}

function rewriteImages(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const alt = attribute(tag, 'alt')?.trim();
    return alt ? `[${alt}]` : '';
  });
}

function rewriteHeadings(html: string): string {
  const re = /<h([1-6])\b[^>]*>/gi;
  let out = '';
  let i = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    out += html.slice(i, match.index);
    const close = html.toLowerCase().indexOf(`</h${match[1]}>`, match.index + match[0].length);
    if (close === -1) {
      out += html.slice(match.index);
      break;
    }
    const inner = html.slice(match.index + match[0].length, close);
    out += `\n\n${stripTags(inner).replace(/\s+/g, ' ').trim().toUpperCase()}\n\n`;
    i = close + `</h${match[1]}>`.length;
    re.lastIndex = i;
  }
  out += html.slice(i);
  return out;
}

export function toText(html: string, options: TextOptions = {}): string {
  const width = options.width ?? 78;

  const first = extractPreheader(html);

  let body = stripComments(html);
  for (const tag of ['head', 'style', 'script']) {
    body = stripPaired(body, tag);
  }
  body = stripHidden(body);

  body = rewriteAnchors(body);
  body = rewriteImages(body);
  body = rewriteHeadings(body);
  body = body
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|table|main|footer|header|section|article|ul|ol|blockquote)>/gi, '\n\n');

  const lines = decodeEntities(stripTags(body))
    .split('\n')
    .map((line) => line.replace(/[ \t\u00A0]+/g, ' ').trim());

  const lead = first.replace(/\s+/g, ' ').trim();
  const text = [...(lead === '' ? [] : [lead, '']), ...lines]
    .flatMap((line) => wrapLine(line, width))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text === '' ? '' : `${text}\n`;
}
