import type { PartStatus, PartTrace, RenderResult } from '../runtime/types';

/** One line of a line diff. */
export interface DiffLine {
  kind: 'same' | 'add' | 'del';
  text: string;
}

export type PartChange = 'added' | 'removed' | 'changed' | 'unchanged';

/** How one part differs between two renders. Parts are matched by id. */
export interface PartDiff {
  id: string;
  change: PartChange;
  statusBefore?: PartStatus;
  statusAfter?: PartStatus;
  /** `after.chars - before.chars`. A part that is new or gone counts from zero. */
  charsDelta: number;
  /** Line diff of the part HTML. Empty when the part is unchanged. */
  lines: readonly DiffLine[];
}

export interface RenderDiff {
  templateBefore: string;
  templateAfter: string;
  /** True when the final HTML or any part differs. */
  changed: boolean;
  parts: readonly PartDiff[];
  /** Line diff of the final document. */
  lines: readonly DiffLine[];
}

/** Above this many line pairs the diff skips the exact search and replaces the middle block. */
const MAX_CELLS = 250_000;

/**
 * Line diff with the common head and tail trimmed first, then an exact
 * longest-common-subsequence over what is left. Output order is stable:
 * deletions come before the additions they pair with.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');

  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail += 1;
  }

  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);

  return [
    ...a.slice(0, head).map(same),
    ...diffMiddle(midA, midB),
    ...a.slice(a.length - tail).map(same),
  ];
}

function same(text: string): DiffLine {
  return { kind: 'same', text };
}

function diffMiddle(a: readonly string[], b: readonly string[]): DiffLine[] {
  if (a.length === 0 || b.length === 0 || a.length * b.length > MAX_CELLS) {
    return [
      ...a.map((text): DiffLine => ({ kind: 'del', text })),
      ...b.map((text): DiffLine => ({ kind: 'add', text })),
    ];
  }

  // lcs[i][j] = length of the longest common subsequence of a[i..] and b[j..].
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i]![j] =
        a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push(same(a[i]!));
      i += 1;
      j += 1;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ kind: 'del', text: a[i]! });
      i += 1;
    } else {
      out.push({ kind: 'add', text: b[j]! });
      j += 1;
    }
  }
  for (; i < a.length; i += 1) out.push({ kind: 'del', text: a[i]! });
  for (; j < b.length; j += 1) out.push({ kind: 'add', text: b[j]! });
  return out;
}

/**
 * Compare two renders part by part. Use it to answer "what did my edit
 * change?" without reading two full documents. Parts match by id, so
 * reordering alone does not count as a change.
 */
export function diffRenders(before: RenderResult, after: RenderResult): RenderDiff {
  const beforeById = new Map(before.parts.map((part) => [part.id, part]));
  const afterById = new Map(after.parts.map((part) => [part.id, part]));
  const ids = [...new Set([...before.parts, ...after.parts].map((part) => part.id))];

  const parts = ids.map((id) => diffPart(id, beforeById.get(id), afterById.get(id)));
  const lines = diffLines(before.html, after.html);

  return {
    templateBefore: before.templateId,
    templateAfter: after.templateId,
    changed: before.html !== after.html || parts.some((part) => part.change !== 'unchanged'),
    parts,
    lines,
  };
}

function diffPart(id: string, before?: PartTrace, after?: PartTrace): PartDiff {
  const charsDelta = (after?.chars ?? 0) - (before?.chars ?? 0);
  const status = {
    ...(before ? { statusBefore: before.status } : {}),
    ...(after ? { statusAfter: after.status } : {}),
  };

  if (!before)
    return { id, change: 'added', charsDelta, lines: diffLines('', after?.html ?? ''), ...status };
  if (!after)
    return { id, change: 'removed', charsDelta, lines: diffLines(before.html, ''), ...status };

  const unchanged = before.html === after.html && before.status === after.status;
  return {
    id,
    change: unchanged ? 'unchanged' : 'changed',
    charsDelta,
    lines: unchanged ? [] : diffLines(before.html, after.html),
    ...status,
  };
}

/** Keep changed lines and `context` lines around them. Gaps become a `…` marker line. */
export function trimContext(lines: readonly DiffLine[], context = 2): DiffLine[] {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((line, index) => {
    if (line.kind === 'same') return;
    for (
      let k = Math.max(0, index - context);
      k <= Math.min(lines.length - 1, index + context);
      k += 1
    ) {
      keep[k] = true;
    }
  });

  const out: DiffLine[] = [];
  let skipping = false;
  lines.forEach((line, index) => {
    if (keep[index]) {
      out.push(line);
      skipping = false;
    } else if (!skipping) {
      out.push({ kind: 'same', text: '…' });
      skipping = true;
    }
  });
  return out;
}

/** Plain-text diff for logs and terminals. `+` added, `-` removed, one line per part change first. */
export function formatDiff(diff: RenderDiff): string {
  if (!diff.changed) return `${diff.templateAfter}: no changes`;

  const out = [`${diff.templateAfter}: changed`];
  for (const part of diff.parts) {
    if (part.change === 'unchanged') continue;
    const sign = part.charsDelta > 0 ? '+' : '';
    out.push(`  ${part.id} ${part.change} (${sign}${part.charsDelta} chars)`);
  }
  for (const line of trimContext(diff.lines)) {
    out.push(`${line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' '} ${line.text}`);
  }
  return out.join('\n');
}
