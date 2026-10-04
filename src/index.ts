export {
  defineTemplate,
  displayErrors,
  hasSlot,
  renderMany,
  renderTemplate,
  slot,
  DisplayError,
  DisplayErrorCode,
  RenderError,
} from './runtime/render';
export type {
  PartFailure,
  PartStatus,
  PartTrace,
  RenderContext,
  RenderJob,
  RenderOptions,
  RenderResult,
  SlotValue,
  Template,
  TemplatePart,
} from './runtime/types';
export { explain } from './runtime/explain';

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

export { document } from './templates/document/document';
export type { DocumentProps } from './templates/document/document';
