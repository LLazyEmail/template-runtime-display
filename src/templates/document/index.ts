/**
 * Document shell entry.
 *
 * Owns the outer HTML document (doctype, html attributes, body attributes)
 * and the helpers that build it. Import from the package root or from
 * `@llazyemail/template-runtime-display/document`.
 */

export { document } from './document';
export type { DocumentProps, DocumentShellOptions } from './document';

export { body } from '../body/body';
export type { BodyProps } from '../body/body';

export { openTag, serializeAttributes } from '../../utils/openTag';
export type { TagAttributes } from '../../utils/openTag';

export { mergeShell } from './mergeShell';
