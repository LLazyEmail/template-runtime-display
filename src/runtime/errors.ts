/** Stable codes for failures this package throws itself. Render failures stay `RenderError`. */
export const DisplayErrorCode = {
  slotType: 'slot_type',
  slotReturn: 'slot_return',
  shellPartMissing: 'shell_part_missing',
} as const;

export type DisplayErrorCode = (typeof DisplayErrorCode)[keyof typeof DisplayErrorCode];

/**
 * Thrown when this package rejects a caller value before or beside rendering.
 * `name` is always `DisplayError`. `code` is the stable id. `message` is the log line.
 */
export class DisplayError extends Error {
  readonly code: DisplayErrorCode;
  readonly details: Readonly<Record<string, string>>;

  constructor(
    code: DisplayErrorCode,
    message: string,
    details: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = 'DisplayError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function received(value: unknown): string {
  return value === null ? 'null' : typeof value;
}

/** Every package-owned throw is built here so the wording stays in one place. */
export const displayErrors = {
  slotType(id: string, value: unknown): DisplayError {
    const kind = received(value);
    return new DisplayError(
      DisplayErrorCode.slotType,
      `slot "${id}" is ${kind}, expected a string or function`,
      { slotId: id, received: kind },
    );
  },
  slotReturn(id: string, value: unknown): DisplayError {
    const kind = received(value);
    return new DisplayError(
      DisplayErrorCode.slotReturn,
      `slot "${id}" returned ${kind}, expected a string`,
      { slotId: id, received: kind },
    );
  },
  shellPartMissing(id: string): DisplayError {
    return new DisplayError(
      DisplayErrorCode.shellPartMissing,
      `email shell is missing part "${id}"`,
      { partId: id },
    );
  },
} as const;
