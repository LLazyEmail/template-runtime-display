export interface ContentProps {
  /** Inner HTML. The wrapper is empty when this is omitted. */
  content?: string;
}

export function content({ content: html }: ContentProps = {}): string {
  return `
    <div>
      ${html || ''}
    </div>`;
}
