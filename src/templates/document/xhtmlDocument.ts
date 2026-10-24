import { document } from './document';
import type { DocumentProps } from './document';

/** XHTML 1.0 Transitional doctype used by classic table-based email templates. */
export const XHTML_DOCTYPE =
  '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';

export type XhtmlDocumentProps = Omit<DocumentProps, 'doctype' | 'lang' | 'htmlAttributes'>;

/**
 * Full XHTML transitional document: XHTML doctype, `<html xmlns="http://www.w3.org/1999/xhtml">`,
 * no `lang`. Same slots as `document()`; the shell is baked in.
 */
export function xhtmlDocument(props: XhtmlDocumentProps = {}): string {
  return document({
    ...props,
    doctype: XHTML_DOCTYPE,
    lang: false,
    htmlAttributes: { xmlns: 'http://www.w3.org/1999/xhtml' },
  });
}
