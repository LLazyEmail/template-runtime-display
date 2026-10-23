import type { RenderError } from '@llazyemail/render-template';
import type { RenderResult } from './types';

/** The failed result a thrown `RenderError` stands for. Its trace is the part list. */
export function fromError(error: RenderError): RenderResult {
  return {
    templateId: error.templateId,
    ok: false,
    html: '',
    parts: error.trace,
  };
}
