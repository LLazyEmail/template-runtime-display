/** HTML string, or a function that receives the same context as a part. */
export type SlotValue<TProps> = string | ((ctx: RenderContext<TProps>) => string);

/** One named step. The id is the name that shows up when this step breaks. */
export interface TemplatePart<TProps> {
  id: string;
  render: (ctx: RenderContext<TProps>) => string;
}

/**
 * A template is data: an id, ordered parts, and a function that stitches
 * part HTML into the final document. The runtime does not know what the
 * parts mean.
 */
export interface Template<TProps> {
  id: string;
  parts: readonly TemplatePart<TProps>[];
  compose: (parts: Readonly<Record<string, string>>, ctx: RenderContext<TProps>) => string;
}

export interface RenderContext<TProps> {
  templateId: string;
  props: TProps;
  /** Caller-supplied custom code or HTML, keyed by slot id. */
  slots: Readonly<Record<string, SlotValue<TProps>>>;
}

export type PartStatus = 'ok' | 'empty' | 'error' | 'skipped';

export interface PartFailure {
  name: string;
  message: string;
}

/** One row of the debug trace. `html` is the full output of that part. */
export interface PartTrace {
  id: string;
  status: PartStatus;
  html: string;
  chars: number;
  ms: number;
  error?: PartFailure;
}

export interface RenderResult {
  templateId: string;
  ok: boolean;
  html: string;
  parts: readonly PartTrace[];
  /** Set when `compose` itself throws and `onError` is `collect`. */
  composeError?: PartFailure;
}

export interface RenderOptions<TProps> {
  /**
   * `throw` stops at the first broken part and throws `RenderError`.
   * `collect` records the error, uses `''` for that part, and continues.
   * Later templates in `renderMany` still run.
   */
  onError?: 'throw' | 'collect';
  slots?: Readonly<Record<string, SlotValue<TProps>>>;
}

/** One template in a batch. Props are whatever that template declared. */
export interface RenderJob<TProps> {
  template: Template<TProps>;
  props?: TProps;
  slots?: Readonly<Record<string, SlotValue<TProps>>>;
}
