import type { RenderResult } from '../runtime/types';
import type { Finding } from './lint';

/** Relative luminance of an sRGB hex color (WCAG). */
function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrast ratio between two hex colors. */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = luminance(expandHex(fg));
  const l2 = luminance(expandHex(bg));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function expandHex(hex: string): string {
  hex = hex.toLowerCase();
  if (hex.length === 4) return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  if (hex.length === 5)
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}${hex[4]}${hex[4]}`;
  return hex.slice(0, 7);
}

function hexFromStyle(style: string, prop: string): string | undefined {
  const re = new RegExp(`${prop}\\s*:\\s*(#[0-9a-f]{3,8})`, 'i');
  const m = re.exec(style);
  const hex = m?.[1];
  if (!hex) return undefined;
  return expandHex(hex);
}

/**
 * Flag inline color/background pairs that fail WCAG AA (4.5:1 for normal text).
 * Analyses the CSS we generate; does not rely on the Light/Dark preview.
 */
export function darkModeContrast(result: RenderResult): Finding[] {
  const findings: Finding[] = [];
  const re = /style\s*=\s*["']([^"']*)["']/gi;
  for (const part of result.parts) {
    for (const match of part.html.matchAll(re)) {
      const style = match[1]!; // group 1 always matches
      const color = hexFromStyle(style, 'color');
      const bg = hexFromStyle(style, 'background(?:-color)?');
      if (!color || !bg) continue;
      const ratio = contrastRatio(color, bg);
      if (ratio < 4.5) {
        findings.push({
          rule: 'dark-mode-contrast',
          severity: 'warn',
          partId: part.id,
          message: `Contrast ${ratio.toFixed(1)}:1 between ${color} and ${bg} fails WCAG AA (4.5:1).`,
          fix: 'Raise the contrast of the inline color/background pair.',
          excerpt: style.slice(0, 80),
          clients: ['dark-mode'],
        });
      }
    }
  }
  return findings;
}
