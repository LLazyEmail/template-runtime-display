# @llazyemail/template-runtime-display

Render a whole HTML email from named parts, then **see exactly which part broke**. A live inspector shows every part's output, timing and error, previews the document at three widths, and diffs each edit against the last render. The email shell is a preset. Any other document is a `Template` you define yourself.

```bash
npx template-runtime-display dev ./letter.mjs     # live inspector, reloads on save
npx template-runtime-display inspect ./letter.mjs # one-shot HTML report, exit 1 if a part broke
```

[![CI](https://github.com/LLazyEmail/template-runtime-display/actions/workflows/ci.yml/badge.svg)](https://github.com/LLazyEmail/template-runtime-display/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Requires **Node.js 24+**. No runtime dependencies. No template registry. Strings you pass are interpolated as HTML.

- Agent guide: [AGENTS.md](./AGENTS.md)
- Short index: [llms.txt](./llms.txt)
- Full API: [llms-full.txt](./llms-full.txt)
- Sample: [examples/compose.ts](./examples/compose.ts)
- Inspector demo: [examples/inspect-demo.mjs](./examples/inspect-demo.mjs)

## Inspector

The inspector turns a render into one self-contained HTML page: a verdict, a banner naming each broken part, output size and timing per part, every part's HTML next to a sandboxed preview, and the finished document at Full, Tablet 768 and Mobile 375. The page has no scripts and makes no network requests. Part HTML only appears inside `sandbox=""` frames and escaped blocks, so a hostile part cannot run code in the report.

### Live: `dev`

```bash
npm run demo    # builds, then serves examples/inspect-demo.mjs, which has a broken part on purpose
```

Write a module that exports `template` (an email template input or a `Template`) and, optionally, `props` and `options`:

```js
// letter.mjs
import { defineEmailTemplate } from '@llazyemail/template-runtime-display';

export const template = defineEmailTemplate({
  id: 'weekly',
  parts: [{ id: 'promo', render: (ctx) => `<p>${ctx.props.code.toUpperCase()}</p>` }],
});
export const props = { title: 'Weekly', code: 'save10' };
```

```bash
npx template-runtime-display dev ./letter.mjs --port 4177
```

- Save the module, or anything under its directory (add more with `--watch <dir>`), and the page reloads.
- After an edit that changes the output, the page lists which parts changed and shows the changed lines.
- `/email` serves the finished document alone.
- Each render runs in a fresh child process, so edits are always picked up. A module that crashes or loops forever shows an error page instead of stopping the server (10 second limit).
- It binds to `127.0.0.1` and rejects requests whose `Host` header is not loopback.
- Default error mode in the CLI is `collect`, so one broken part does not hide the rest. Set `options.onError` in the module to change that.
- Node 24 can load a `.ts` module that uses only erasable syntax and explicit `.ts` import paths.

### One-shot: `inspect`

```bash
npx template-runtime-display inspect ./letter.mjs --out report.html
```

Prints the same trace as `explain`, writes the report, and exits `0` when every part rendered, `1` when a part broke, `2` when the module could not be rendered at all. A report is written in every case, so CI can attach it as an artifact.

### From code

```ts
import { diffRenders, formatDiff, inspect } from '@llazyemail/template-runtime-display';

const before = renderEmail(template, props, { onError: 'collect' });
const after = renderEmail(template, { ...props, code: 'save20' }, { onError: 'collect' });

writeFileSync('report.html', inspect(after, { compareTo: before }));
console.log(formatDiff(diffRenders(before, after)));
```

`inspect(resultOrRenderError, { title?, compareTo? })` returns the page as a string. `diffRenders(before, after)` matches parts by id and returns a per-part and whole-document line diff. `formatDiff` prints it for a terminal.

## Package ecosystem and Lit

This package builds on `@llazyemail/render-template` (currently pinned via GitHub ref `github:LLazyEmail/render-template#0.3.0` in `package.json`). Prefer a published version from GitHub Packages when one is available and compatible, to reduce install fragility.

Parts must return **strings**. Lit `TemplateResult`s are not supported inside parts.

Consumers that still use Lit SSR (e.g. `_playing_with_lit`) keep a thin local adapter (`renderEmailBody` + `stripLitMarkers`) that turns a Lit result into a string, then pass that string into `document` / `renderTemplate` / `renderEmail`. Do not try to put Lit templates directly into a part `render` function — that is a known source of runtime errors.

Generation/catalog/write logic belongs in `@llazyemail/generate-template`, not here.

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

`collect` records the broken part, uses `''` for it, and continues. `result.ok` is false. Full HTML for every part that ran stays on `result.parts[].html`. `renderMany` is `@llazyemail/render-template`'s batch helper, re-exported here, and uses the same switch. In throw mode the first broken job stops the batch. Pass `collect` when one failure must not hide the rest. Jobs in one batch share a props type.

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

| Function                                                                                             | Role                                                                                                                    |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `head({ title?, preview?, styles?, extraHead? })`                                                    | `<head>` with inbox meta, `<title>`, optional preheader, styles, extra HTML                                             |
| `main({ heading?, bodyText?, ctaLabel?, ctaUrl?, innerHtml? })`                                      | `<main>` with an `<h1>`, a paragraph, and an optional button, or raw `innerHtml`                                        |
| `footer({ companyName?, unsubscribeUrl? })`                                                          | `<footer>` with the company name and an optional unsubscribe link                                                       |
| `body({ preheaderHtml?, mainHtml?, footerHtml?, attributes? })`                                      | `<body>` around an optional preheader, main, and footer. Optional raw attributes.                                       |
| `content({ content? })`                                                                              | A `<div>` around raw HTML. The email shell does not call it                                                             |
| `document({ headHtml?, mainHtml?, footerHtml?, doctype?, lang?, htmlAttributes?, bodyAttributes? })` | Doctype, `<html>`, head, and body. Defaults to HTML5 + `lang="en"`. Attributes accept a raw string or a structured map. |

Omitted strings render empty. The button is present only when both `ctaLabel` and `ctaUrl` are set. The unsubscribe link is present only when `unsubscribeUrl` is set.

`bodyText`, `content`, and slot strings may contain inline HTML. Callers own that markup. `escapeHtml` is exported for text and attribute positions; the shell does not call it.

Subpath exports: `@llazyemail/template-runtime-display/escape`, `/head`, `/body`, `/main`, and `/document`.

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
npm run demo         # build, then serve the inspector on examples/inspect-demo.mjs
npm run inspect -- <module>  # one-shot report from the built CLI
npm run generate     # render a letter, print explain(), write generated/letter.html
npm run publint
npm run smoke        # load the ESM, CJS, and script-tag builds
npm run check        # format, lint, typecheck, build, test, smoke, publint
```

`markup-generator` is installed for local checks. `test/write.test.ts` renders a letter with `renderEmail` and writes it with `writeGeneratedFile`.

## License

MIT


## Planned: Email Quality Toolkit

See [docs/email-quality-toolkit.md](./docs/email-quality-toolkit.md) for the proposed lint, plain-text, dark-mode and size checks that will attach as `result.quality` on renders. This is future work; the current release adds the inspector and CLI only.

