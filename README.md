# @llazyemail/template-runtime-display

Pure functions that return HTML fragments for an email document: `head`, `main`, `body`, `footer`, `content`, and the full `document`.

[![CI](https://github.com/LLazyEmail/template-runtime-display/actions/workflows/ci.yml/badge.svg)](https://github.com/LLazyEmail/template-runtime-display/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Requires **Node.js 24+**. No runtime dependencies. Strings you pass are interpolated as HTML.

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

## Compose a letter

```ts
import { document, footer, head, main } from '@llazyemail/template-runtime-display';

const html = document({
  headHtml: head({ title: 'Weekly update', preview: 'Three things that shipped' }),
  mainHtml: main({
    heading: 'Weekly update',
    bodyText: 'Three things that shipped.',
    ctaLabel: 'Read',
    ctaUrl: 'https://example.com/update',
  }),
  footerHtml: footer({
    companyName: 'LLazyEmail',
    unsubscribeUrl: 'https://example.com/unsubscribe',
  }),
});
```

`document` always starts with `<!DOCTYPE html>` and uses `<html lang="en">`. The same props always return the same string.

## API

| Function                                            | Role                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| `head({ title?, preview? })`                        | `<head>` with charset, viewport, `<title>`, and a hidden preview div |
| `main({ heading?, bodyText?, ctaLabel?, ctaUrl? })` | `<main>` with an `<h1>`, a paragraph, and an optional button         |
| `footer({ companyName?, unsubscribeUrl? })`         | `<footer>` with the company name and an optional unsubscribe link    |
| `body({ mainHtml?, footerHtml? })`                  | `<body>` around the main and footer fragments                        |
| `content({ content? })`                             | A `<div>` around raw HTML                                            |
| `document({ headHtml?, mainHtml?, footerHtml? })`   | Doctype, `<html lang="en">`, head, and body                          |

Omitted strings render empty. The button is present only when both `ctaLabel` and `ctaUrl` are set. The unsubscribe link is present only when `unsubscribeUrl` is set.

`bodyText` and `content` may contain inline HTML. Callers own that markup.

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
npm run generate     # write generated/letter.html with markup-generator
npm run publint
npm run smoke        # load the ESM, CJS, and script-tag builds
npm run check        # format, lint, typecheck, build, test, smoke, publint
```

`markup-generator` is installed for local checks. `src/write.test.ts` renders a letter and writes it with `writeGeneratedFile`.

## License

MIT
