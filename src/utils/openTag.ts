/**
 * Raw attribute string or a structured attribute map.
 * Values are interpolated raw (callers own escaping), matching package policy.
 * Boolean `true` emits the bare attribute name; `false`/`null`/`undefined` are omitted.
 */
export type TagAttributes = string | Record<string, string | number | boolean | null | undefined>;

/**
 * Build an opening tag with optional attributes.
 * Attributes are interpolated raw (callers own escaping), matching package policy.
 */
export function openTag(name: string, attributes?: TagAttributes): string {
  const attr = serializeAttributes(attributes);
  return attr ? `<${name} ${attr}>` : `<${name}>`;
}

/** Turn a raw string or attribute map into a single attribute string. */
export function serializeAttributes(attributes?: TagAttributes): string {
  if (!attributes) return '';
  if (typeof attributes === 'string') return attributes.trim();

  const parts: string[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (value === true) {
      parts.push(key);
    } else {
      parts.push(`${key}="${String(value)}"`);
    }
  }
  return parts.join(' ');
}
