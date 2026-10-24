export {
  defineTemplate,
  displayErrors,
  hasSlot,
  renderMany,
  renderTemplate,
  slot,
  DisplayError,
  DisplayErrorCode,
} from './runtime/render';
export type {
  PartFailure,
  PartStatus,
  PartTrace,
  RenderContext,
  RenderResult,
  SlotValue,
  Template,
  TemplatePart,
} from './runtime/types';
export type { RenderJob, RenderOptions } from '@llazyemail/render-template';
export { RenderError } from '@llazyemail/render-template';
export { explain } from './runtime/explain';

export { inspect } from './inspect/inspect';
export type { InspectOptions } from './inspect/inspect';
export { traceJson, traceJsonText } from './inspect/json';
export type { TraceJson, TraceJsonOptions, TraceJsonPart } from './inspect/json';
export { diffRenders, formatDiff } from './inspect/diff';
export type { DiffLine, PartChange, PartDiff, RenderDiff } from './inspect/diff';

export { defineEmailTemplate, renderEmail } from './templates/email/email';
export type { EmailProps, EmailTemplate } from './templates/email/email';

export { escapeHtml } from './utils/escape';

export { head } from './templates/head/head';
export type { HeadProps } from './templates/head/head';

export { main } from './templates/main/main';
export type { MainProps } from './templates/main/main';

export { footer } from './templates/footer/footer';
export type { FooterProps } from './templates/footer/footer';

export { body } from './templates/body/body';
export type { BodyProps } from './templates/body/body';

export { content } from './templates/content/content';
export type { ContentProps } from './templates/content/content';

export { document, mergeShell, openTag, serializeAttributes } from './templates/document';
export type { DocumentProps, DocumentShellOptions, TagAttributes } from './templates/document';
export { xhtmlDocument, XHTML_DOCTYPE } from './templates/document';
export type { XhtmlDocumentProps } from './templates/document';

export { byteLength, measureSize, CLIP_BYTES, NEAR_BYTES } from './quality/size';
export type { ClipRisk, PartSize, SizeOptions, SizeReport } from './quality/size';
export { toText } from './quality/text';
export type { TextOptions } from './quality/text';
