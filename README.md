# @llazyemail/template-runtime-display

Standalone runtime that renders a whole HTML email from named parts, and a per-part trace when custom code breaks. The email shell is a preset. Any other document is a `Template` you define yourself.

[![CI](https://github.com/LLazyEmail/template-runtime-display/actions/workflows/ci.yml/badge.svg)](https://github.com/LLazyEmail/template-runtime-display/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Requires **Node.js 24+**. No runtime dependencies. No template registry. Strings you pass are interpolated as HTML.

- Agent guide: [AGENTS.md](./AGENTS.md)
- Short index: [llms.txt](./llms.txt)
- Full API: [llms-full.txt](./llms-full.txt)
- Sample: [examples/compose.ts](./examples/compose.ts)

## Install

Published to GitHub Packages. Copy [`.npmrc.example`](./.npmrc.example) to `.npmrc` in the consuming project. `GITHUB_TOKEN` needs `read:packages`.

```bash
npm install @llazyemail/template-runtime-display
```

A GitHub Release on `main` runs [`.github/workflows/publish.yml`](./.github/workflows/publish.yml). The manual workflow publishes too, unless "Pack only" is checked.

ESM, CommonJS, and a script-tag build (`dist/index.global.js`, global `TemplateRuntimeDisplay`) are all published.

## Render an email

```ts
import { renderEmail, slot } from '@llazyemail/template-runtime-display';

const result = renderEmail(
  {
    id: 'weekly',
    parts: [{ id: 'note', render: (ctx) => slot(ctx, 'note') }],
  },
  {
    title: 'Weekly update',
    preview: 'Three things that shipped',
    heading: 'Weekly update',
    bodyText: 'Three things that shipped.',
    ctaLabel: 'Read',
    ctaUrl: 'https://example.com/update',
    companyName: 'LLazyEmail',
    unsubscribeUrl: 'https://example.com/unsubscribe',
  },
  { slots: { note: '<p>Custom note</p>' } },
);

result.html;
```

`result.html` starts with `<!DOCTYPE html>` and uses `<html lang="en">`. The same template, props, and slots return the same HTML. Custom parts sit inside `<body>` after `main` and before `footer`. A missing slot renders as empty. A slot named `head`, `main`, or `footer` replaces that region.

`defineEmailTemplate` returns the `Template` when you want to keep it and render it more than once. `renderEmail` accepts that template or the input object above.

## See which part broke

The default is `onError: 'throw'`. The thrown `RenderError` carries `templateId`, `partId`, `cause`, and a trace where later parts are `skipped`. `explain` prints that error.

```ts
import { explain, renderEmail } from '@llazyemail/template-runtime-display';

const result = renderEmail(template, props, { onError: 'collect' });
explain(result);
```

`collect` records the broken part, uses `''` for it, and continues. `result.ok` is false. Full HTML for every part that ran stays on `result.parts[].html`. `renderMany` uses the same switch. In throw mode the first broken job stops the batch. Pass `collect` when one failure must not hide the rest. Jobs in one batch share a props type.

## A document that is not the email shell

```ts
import { defineTemplate, renderTemplate, slot } from '@llazyemail/template-runtime-display';

const page = defineTemplate<{ title: string }>({
  id: 'page',
  parts: [
    { id: 'title', render: (ctx) => `<h1>${ctx.props.title}</h1>` },
    { id: 'extra', render: (ctx) => slot(ctx, 'extra') },
  ],
  compose: (parts) => `<article>${parts['title'] ?? ''}${parts['extra'] ?? ''}</article>`,
});

renderTemplate(page, { title: 'Hello' }, { slots: { extra: '<p>More</p>' } });
```

`defineTemplate` copies and freezes the part list. Callers keep the catalog. The runtime keeps nothing between calls.

## Fragments

The email preset calls these. They stay public so a part, or a caller, can use them directly.

| Function                                                        | Role                                                                             |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `head({ title?, preview?, styles?, extraHead? })`               | `<head>` with inbox meta, `<title>`, optional preheader, styles, extra HTML      |
| `main({ heading?, bodyText?, ctaLabel?, ctaUrl?, innerHtml? })` | `<main>` with an `<h1>`, a paragraph, and an optional button, or raw `innerHtml` |
| `footer({ companyName?, unsubscribeUrl? })`                     | `<footer>` with the company name and an optional unsubscribe link                |
| `body({ preheaderHtml?, mainHtml?, footerHtml? })`              | `<body>` around an optional preheader, main, and footer                          |
| `content({ content? })`                                         | A `<div>` around raw HTML. The email shell does not call it                      |
| `document({ headHtml?, mainHtml?, footerHtml? })`               | Doctype, `<html lang="en">`, head, and body                                      |

Omitted strings render empty. The button is present only when both `ctaLabel` and `ctaUrl` are set. The unsubscribe link is present only when `unsubscribeUrl` is set.

`bodyText`, `content`, and slot strings may contain inline HTML. Callers own that markup. `escapeHtml` is exported for text and attribute positions; the shell does not call it.

Subpath exports: `@llazyemail/template-runtime-display/escape`, `/head`, `/body`, and `/main`.

## Scripts

```bash
npm install
npm run dev          # tsup --watch
npm run build        # tsup → dist/ (ESM, CJS, IIFE, .d.ts, sourcemaps)
npm test             # vitest run
npm run test:watch
npm run test:coverage
npm run typecheck    # tsc --noEmit
npm run lint
npm run format       # prettier --write
npm run format:check
npm run generate     # render a letter, print explain(), write generated/letter.html
npm run publint
npm run smoke        # load the ESM, CJS, and script-tag builds
npm run check        # format, lint, typecheck, build, test, smoke, publint
```

`markup-generator` is installed for local checks. `src/write.test.ts` renders a letter with `renderEmail` and writes it with `writeGeneratedFile`.

## License

MIT
