import { describe, expect, it } from 'vitest';
import { defineEmailTemplate, renderEmail } from '../src/index';
import { qualityReport } from '../src/quality/report';

describe('qualityReport', () => {
  it('returns findings, size and text for a rendered email', () => {
    const result = renderEmail(
      { id: 'demo', parts: [] },
      { heading: 'Hi', bodyText: 'Hello', unsubscribeUrl: 'https://example.com/unsub' },
    );
    const report = qualityReport(result);
    expect(report.size.bytes).toBeGreaterThan(0);
    expect(report.text).toContain('HI');
    expect(Array.isArray(report.findings)).toBe(true);
  });
});

describe('renderEmail check option', () => {
  it('attaches quality when check is true', () => {
    const result = renderEmail(
      { id: 'demo', parts: [] },
      { heading: 'Hi', unsubscribeUrl: 'https://example.com/unsub' },
      { check: true },
    );
    expect(result.quality).toBeDefined();
    expect(result.quality?.size.bytes).toBeGreaterThan(0);
    expect(result.quality?.text).toContain('HI');
  });

  it('omits quality by default and keeps the html identical', () => {
    const props = { heading: 'Hi', bodyText: 'Hello', unsubscribeUrl: 'https://example.com/unsub' };
    const plain = renderEmail({ id: 'demo', parts: [] }, props);
    const checked = renderEmail({ id: 'demo', parts: [] }, props, { check: true });
    expect(plain.quality).toBeUndefined();
    expect(plain.html).toBe(checked.html);
    // Timing fields may differ between renders; compare everything else.
    const withoutTiming = (parts: typeof plain.parts) => parts.map(({ ms: _ms, ...rest }) => rest);
    expect(withoutTiming(plain.parts)).toEqual(withoutTiming(checked.parts));
  });

  it('works with a pre-defined template', () => {
    const template = defineEmailTemplate({ id: 'pre', parts: [] });
    const result = renderEmail(template, { heading: 'X' }, { check: true });
    expect(result.quality).toBeDefined();
  });
});
