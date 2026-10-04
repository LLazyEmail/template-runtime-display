/** Drop omitted fields so callers can pass the result under exactOptionalPropertyTypes. */
export function pickDefined<T extends Record<string, string | undefined>>(
  values: T,
): {
  [K in keyof T]?: string;
} {
  const picked: { [K in keyof T]?: string } = {};
  for (const key of Object.keys(values) as (keyof T)[]) {
    const value = values[key];
    if (typeof value === 'string') picked[key] = value;
  }
  return picked;
}
