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

/** Remove tags with a single linear scan. The regex form can backtrack on
 *  inputs that start with `<` and contain many `<` with no matching `>`. */
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
      // Unclosed tag: keep the rest as text so we never loop.
      out += html.slice(open);
      break;
    }
    i = close + 1;
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
export function toText(html: string, options: TextOptions = {}): string {
  const width = options.width ?? 78;

  const preheader =
    /<span[^>]*class\s*=\s*["'][^"']*\bpreheader\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(html);
  const first = preheader?.[1] === undefined ? '' : decodeEntities(stripTags(preheader[1]));

  let body = html;
  let previous: string;
  do {
    previous = body;
    body = body
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(head|style|script)\b[\s\S]*?<\/\1>/gi, '')
      .replace(/<(div|span|p|td|table|tr)\b[^>]*display\s*:\s*none[^>]*>[\s\S]*?<\/\1>/gi, '');
  } while (body !== previous);

  body = body
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_match, attrs: string, inner: string) => {
      const label = decodeEntities(stripTags(inner)).trim();
      const href = (attribute(` ${attrs}`, 'href') ?? '').trim();
      if (href === '' || href.startsWith('#') || /^javascript:/i.test(href)) return label;
      return label === '' || label === href ? href : `${label} (${href})`;
    })
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const alt = attribute(tag, 'alt')?.trim();
      return alt ? `[${alt}]` : '';
    })
    .replace(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_match, inner: string) => {
      return `\n\n${stripTags(inner).replace(/\s+/g, ' ').trim().toUpperCase()}\n\n`;
    })
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|table|main|footer|header|section|article|ul|ol|blockquote)>/gi, '\n\n');

  const lines = decodeEntities(stripTags(body))
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim());

  const lead = first.replace(/\s+/g, ' ').trim();
  const text = [...(lead === '' ? [] : [lead, '']), ...lines]
    .flatMap((line) => wrapLine(line, width))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text === '' ? '' : `${text}\n`;
}
