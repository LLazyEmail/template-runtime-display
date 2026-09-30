import { body } from './body';
import type { BodyProps } from './body';

export interface DocumentProps extends BodyProps {
  /** `<head>` fragment, placed directly after `<html>`. */
  headHtml?: string;
}

export function document(props: DocumentProps = {}): string {
  return `<!DOCTYPE html>
<html lang="en">
${props.headHtml}
${body(props)}
</html>`;
}
