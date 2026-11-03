import type { RenderResult } from '../runtime/types';
import type { Finding } from './lint';
import { lintEmail } from './lint';
import { measureSize, type SizeReport } from './size';
import { toText } from './text';

export interface QualityReport {
  findings: Finding[];
  size: SizeReport;
  text: string;
}

/** Build the quality report for a rendered email. Pure; does not mutate the result. */
export function qualityReport(result: RenderResult): QualityReport {
  return {
    findings: lintEmail(result),
    size: measureSize(result),
    text: toText(result.html),
  };
}
