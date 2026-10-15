/**
 * Build an opening tag with optional raw attributes.
 * Attributes are interpolated raw (callers own escaping), matching package policy.
 */
export function openTag(name: string, attributes?: string): string {
  const attr = attributes?.trim();
  return attr ? `<${name} ${attr}>` : `<${name}>`;
}
