import { body } from './body';
import type { BodyProps } from './body';

export interface DocumentProps extends BodyProps {
  /** `<head>` fragment, placed directly after `<html>`. */
  headHtml?: string;
}

/** Full HTML document. `lang` is `en`. Omitted fragments are empty strings. */
export function document({ headHtml = '', ...rest }: DocumentProps = {}): string {
  return `<!DOCTYPE html>
<html lang="en">
${headHtml}
${body(rest)}
</html>`;
}
