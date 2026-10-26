import { describe, expect, it } from 'vitest';
import type { PartTrace, RenderResult } from '../src/index';
import { contrastRatio, darkModeContrast } from '../src/quality/contrast';
import { lintEmail } from '../src/quality/lint';

function part(id: string, html: string): PartTrace {
  return { id, status: 'ok', html, chars: html.length, ms: 0 };
}
function result(parts: PartTrace[]): RenderResult {
  return { templateId: 'demo', ok: true, html: parts.map((p) => p.html).join(''), parts };
}

describe('contrastRatio', () => {
  it('computes known ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#888888')).toBeLessThan(4.5);
  });

  it('expands short hex forms', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 0);
    expect(contrastRatio('#ffff', '#0000')).toBeGreaterThan(1);
  });
});

describe('darkModeContrast', () => {
  it('flags a low-contrast inline pair', () => {
    const findings = darkModeContrast(
      result([part('card', '<div style="color:#777; background:#888">low</div>')]),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe('dark-mode-contrast');
    expect(findings[0].partId).toBe('card');
  });

  it('passes a high-contrast pair', () => {
    const findings = darkModeContrast(
      result([part('card', '<div style="color:#000; background-color:#fff">ok</div>')]),
    );
    expect(findings).toHaveLength(0);
  });

  it('ignores styles without both colors', () => {
    const findings = darkModeContrast(result([part('x', '<div style="color:#000">only fg</div>')]));
    expect(findings).toHaveLength(0);
  });

  it('runs as part of lintEmail', () => {
    const findings = lintEmail(
      result([part('card', '<div style="color:#ccc; background:#ddd">low</div>')]),
    );
    expect(findings.some((f) => f.rule === 'dark-mode-contrast')).toBe(true);
  });
});
