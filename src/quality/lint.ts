import type { RenderResult } from '../runtime/types';

export type Severity = 'error' | 'warn' | 'info';

export interface Finding {
  rule: string;
  severity: Severity;
  partId?: string;
  message: string;
  fix?: string;
  clients?: string[];
  excerpt?: string;
}

export type Rule = (result: RenderResult) => Finding[];

export interface LintOptions {
  /** Extra rules to run after the built-in set. */
  rules?: readonly Rule[];
  /** Rule ids to skip. */
  off?: readonly string[];
}

const BUILTIN: readonly Rule[] = [
  noFlexGridLayout,
  noExternalStylesheet,
  noScriptOrForm,
  imgNeedsAltAndSize,
  linkHygiene,
  htmlLangAndTitle,
  unsubscribePresent,
];

/** Run the built-in client-compatibility rules and any extras. */
export function lintEmail(result: RenderResult, options: LintOptions = {}): Finding[] {
  const off = new Set(options.off ?? []);
  const rules = [...BUILTIN, ...(options.rules ?? [])];
  const findings: Finding[] = [];
  for (const rule of rules) {
    for (const finding of rule(result)) {
      if (!off.has(finding.rule)) findings.push(finding);
    }
  }
  return findings;
}

function excerpt(html: string, max = 80): string {
  const flat = html.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

function inParts(result: RenderResult, test: (html: string) => boolean): Finding[] {
  const findings: Finding[] = [];
  for (const part of result.parts) {
    if (test(part.html)) {
      findings.push({
        rule: '',
        severity: 'warn',
        partId: part.id,
        message: '',
        excerpt: excerpt(part.html),
      });
    }
  }
  // Also check the final document for things that may only appear in the shell.
  if (findings.length === 0 && test(result.html)) {
    findings.push({
      rule: '',
      severity: 'warn',
      message: '',
      excerpt: excerpt(result.html),
    });
  }
  return findings;
}

function noFlexGridLayout(result: RenderResult): Finding[] {
  const re = /display\s*:\s*(flex|grid)|float\s*:\s*(left|right)/i;
  return inParts(result, (html) => re.test(html)).map((f) => ({
    ...f,
    rule: 'no-flex-grid-layout',
    severity: 'error',
    message: 'Flex, grid or float used for layout. Outlook for Windows collapses these.',
    fix: 'Use table-based layout with align and width attributes.',
    clients: ['outlook-windows'],
  }));
}

function noExternalStylesheet(result: RenderResult): Finding[] {
  const re = /<link\b[^>]*rel\s*=\s*["']?stylesheet/i;
  return inParts(result, (html) => re.test(html)).map((f) => ({
    ...f,
    rule: 'no-external-stylesheet',
    severity: 'error',
    message: 'External stylesheet. Most clients strip <link rel=stylesheet>.',
    fix: 'Inline critical styles or put them in a <style> block in the head.',
    clients: ['gmail', 'outlook'],
  }));
}

function noScriptOrForm(result: RenderResult): Finding[] {
  const re = /<(script|form|iframe|video)\b/i;
  return inParts(result, (html) => re.test(html)).map((f) => ({
    ...f,
    rule: 'no-script-or-form',
    severity: 'error',
    message: 'script, form, iframe or video. Removed or blocked; a form is a deliverability risk.',
    fix: 'Remove interactive elements. Use a link instead of a form.',
    clients: ['all'],
  }));
}

function imgNeedsAltAndSize(result: RenderResult): Finding[] {
  const findings: Finding[] = [];
  const re = /<img\b[^>]*>/gi;
  for (const part of result.parts) {
    for (const match of part.html.matchAll(re)) {
      const tag = match[0];
      const hasAlt = /\balt\s*=/.test(tag);
      const hasWidth = /\bwidth\s*=/.test(tag);
      const hasHeight = /\bheight\s*=/.test(tag);
      if (!hasAlt || !hasWidth || !hasHeight) {
        findings.push({
          rule: 'img-needs-alt-and-size',
          severity: 'warn',
          partId: part.id,
          message: 'Image is missing alt, width or height. Blocked images collapse the layout.',
          fix: 'Add alt, width and height attributes.',
          excerpt: excerpt(tag),
          clients: ['outlook', 'gmail'],
        });
      }
    }
  }
  return findings;
}

function linkHygiene(result: RenderResult): Finding[] {
  const findings: Finding[] = [];
  const re = /<a\b[^>]*>/gi;
  for (const part of result.parts) {
    for (const match of part.html.matchAll(re)) {
      const tag = match[0];
      const hrefMatch = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
      const href = (hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? '').trim();
      if (href === '' || href === '#' || /^javascript:/i.test(href) || !/^https?:/i.test(href)) {
        findings.push({
          rule: 'link-hygiene',
          severity: 'warn',
          partId: part.id,
          message: 'Link href is empty, #, javascript: or not http(s).',
          fix: 'Use a full https URL.',
          excerpt: excerpt(tag),
          clients: ['all'],
        });
      }
    }
  }
  return findings;
}

function htmlLangAndTitle(result: RenderResult): Finding[] {
  const findings: Finding[] = [];
  if (!/<html\b[^>]*\blang\s*=/i.test(result.html)) {
    findings.push({
      rule: 'html-lang-and-title',
      severity: 'warn',
      message: 'Missing lang attribute on <html>.',
      fix: 'Add lang="en" (or the appropriate language) to the html tag.',
    });
  }
  if (!/<title\b[^>]*>[^<]+<\/title>/i.test(result.html)) {
    findings.push({
      rule: 'html-lang-and-title',
      severity: 'info',
      message: 'Missing or empty <title>.',
      fix: 'Add a non-empty <title> in the head.',
    });
  }
  return findings;
}

function unsubscribePresent(result: RenderResult): Finding[] {
  const hasUnsub = /unsubscribe/i.test(result.html);
  if (!hasUnsub) {
    return [
      {
        rule: 'unsubscribe-present',
        severity: 'warn',
        message: 'No unsubscribe link found. Required by Gmail/Yahoo bulk-sender rules.',
        fix: 'Add a visible unsubscribe link in the footer.',
        clients: ['gmail', 'yahoo'],
      },
    ];
  }
  return [];
}
