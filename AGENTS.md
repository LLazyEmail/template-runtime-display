# Agent notes for template-runtime-display

`@llazyemail/template-runtime-display` is a stateless runtime that renders a whole HTML email from named parts, plus the fragment functions those parts call. No DOM, no I/O, no runtime dependencies. Custom code is just another part. When a part throws, the trace names it.

The package is stateless, so loading the ESM and CJS builds in one process is safe.

## Commands

```bash
npm install
npm run dev            # tsup --watch
npm run build          # dist/index.js, dist/index.cjs, dist/index.global.js, dist/index.d.ts
npm test               # vitest run — test/**/*.test.ts
npm run test:coverage  # v8 coverage; executable src files must stay at 100%
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run lint:fix
npm run format         # prettier --write
npm run format:check
npm run generate       # build, render a letter, print explain(), write generated/letter.html
npm run publint        # export and types check; requires dist/
npm run smoke          # load the ESM, CJS, and IIFE builds; requires dist/
npm run check          # format, lint, typecheck, build, test, smoke, publint
```

Node.js **24+**. Run `npm run check` before handing work back. Run `npm run test:coverage` when you add or change an executable `src/` file. `src/index.ts`, `src/runtime/types.ts`, and `src/templates/email/types.ts` are excluded: v8 reports 0% on files with no runtime code.

ESLint and Prettier both run in CI. Tests are Vitest, not Jest. `markup-generator` is a devDependency used to write rendered HTML in `test/write.test.ts` and `npm run generate`. It is not a runtime dependency.

## Layout

```
src/index.ts                      public exports only — consumers import the package root
src/runtime/types.ts              template, context, and trace types
src/runtime/render.ts             defineTemplate, renderTemplate, renderMany
src/runtime/api.ts                slot, hasSlot
src/runtime/errors.ts             DisplayError, codes, and message catalog
src/runtime/explain.ts            explain()
src/templates/email/email.ts      defineEmailTemplate, renderEmail
src/templates/email/shell.ts      shell parts and compose
src/templates/email/types.ts      EmailProps, EmailTemplate
src/templates/head/head.ts        head()
src/templates/main/main.ts        main()
src/templates/footer/footer.ts    footer()
src/templates/body/body.ts        body()
src/templates/content/content.ts  content()
src/templates/document/document.ts document()
src/utils/escape.ts               escapeHtml()
src/utils/pickDefined.ts          drop omitted string fields
test/runtime.test.ts    runtime spec
test/email.test.ts      email preset spec
test/index.test.ts      fragment spec
examples/compose.ts    sample letter; sampleHtml is covered by the suite
test/write.test.ts      writes a rendered letter through markup-generator and reads it back
scripts/generate.mjs   prints explain() and writes generated/letter.html
.github/workflows/ci.yml
.github/workflows/publish.yml   GitHub Packages on release, or a manual run
llms.txt               short index for agents
llms-full.txt          runtime contract and fragment props
tsup.config.ts         ESM + CJS + IIFE, dts, sourcemaps
vitest.config.ts
```

Do not add a second entry point. Do not add `src/**/*.js` next to a `.ts` file. Do not add a template registry.

## Runtime model

A `Template<TProps>` is data: an id, an ordered list of parts, and a `compose` function. The runtime does not know what a part means. Callers own the catalog.

`defineTemplate` checks the id and the part ids, copies each part, and freezes the template. The part id `compose` is reserved. Empty ids and duplicate ids throw `RenderError`. `renderTemplate` checks again, so a hand-built template gets the same rules.

Each part receives one context: `templateId`, the same props object the caller passed, and a frozen shallow copy of `slots`. Props are not copied. A part returns HTML. `null` and `undefined` become `''`. Any other non-string is an error. A thrown part is an error.

`onError: 'throw'` (the default) records the broken part, marks every later part `skipped`, and throws `RenderError` with `templateId`, `partId`, the trace, and `cause`. `onError: 'collect'` records the error, uses `''` for that part, and continues. `result.ok` is then false. A compose failure uses the part id `compose` in throw mode, and sets `result.composeError` in collect mode. The result HTML is `''` in that collect case.

`explain` prints a short status report. A thrown `RenderError` prints its message. A result prints `ok` or `failed`, the part count, and the HTML length. Each part is one line: id, status, chars, ms, and the error when there is one. Full HTML stays on `parts[].html`.

`renderMany`, `RenderJob`, `RenderOptions`, and `RenderError` come from `@llazyemail/render-template`. This package re-exports them. `renderMany` runs jobs that share one props type. Throw mode stops the batch at the first broken job, and later jobs do not run. Pass `onError: 'collect'` when one broken template must not hide the others. Jobs may omit `props` (`{}`) and `slots`.

Custom code is a part, or a slot that a part reads with `slot(ctx, id)`. A missing slot is `''`. `hasSlot` is true for an empty string. A function slot is called with the same context. `null` or `undefined` from that function is `''`. A non-string slot, or a non-string return, throws `DisplayError` (`slot_type` or `slot_return`) and the part that called `slot` is the part that fails. Package-owned messages are built in `src/runtime/errors.ts`. Render and validation failures stay `RenderError`.

`defineEmailTemplate` and `renderEmail` are a preset over the same runtime. Part order is `head`, `main`, the caller's parts, then `footer`. Compose places custom HTML inside `<body>` after `main` and before `footer`, joined with newlines. With no custom parts, the HTML equals `document({ headHtml: head(...), mainHtml: main(...), footerHtml: footer(...) })`. A slot named `head`, `main`, or `footer` replaces that built-in fragment. Omitted email props follow the fragment omission rules. `content()` is not in the shell. A custom part may call it.

Traces and defined templates are frozen so a later template cannot change an earlier debug snapshot.

## Invariants

- Named exports only. No default export. Import the package root.
- Fragment helpers (`head`, `main`, `footer`, `body`, `content`, `document`) are `(props?) => string`.
- `renderTemplate`, `renderEmail`, and `renderMany` return results. They throw `RenderError` when `onError` is `throw` (the default).
- `explain` returns a string. `slot` returns a string. `hasSlot` returns a boolean. `defineTemplate` and `defineEmailTemplate` return a `Template`.
- The same template, props, and slots return the same HTML, including whitespace. Timing fields on the trace may differ.
- Omitted optional strings render as empty strings. Output must not contain the word `undefined`.
- `main` emits the CTA `<a>` only when both `ctaLabel` and `ctaUrl` are set.
- `footer` emits `Unsubscribe` only when `unsubscribeUrl` is set.
- `document` starts with `<!DOCTYPE html>`, then `<html lang="en">`. `lang` stays `en`.
- `head` always emits charset `utf-8`, the viewport meta, a `<title>`, and the hidden preview `<div>`.
- Props and slots are interpolated raw. This package has no escape step. Keep it that way unless the task asks for escaping.
- `bodyText`, `content`, and slot strings are allowed to contain HTML.
- Zero runtime dependencies. Dev tooling stays in `devDependencies`.
- Public types ship from `src/index.ts` through tsup `dts`. Keep `tsconfig` `types` empty so `@types/node` cannot leak into `.d.ts`.

## Add a fragment

1. Add `src/templates/<name>/<name>.ts` with a props interface (JSDoc on each field) and one function. Default omitted strings to `''`. Shared helpers go in `src/utils/`.
2. Re-export the function and the type from `src/index.ts`.
3. Extend `test/index.test.ts`: default render, each omission rule, and the filled-in render.
4. Add the function to `README.md`, `llms.txt`, and `llms-full.txt`.
5. Run `npm run check` and `npm run test:coverage`.

A new email region that is not a fragment belongs in `defineEmailTemplate` only when every letter needs it. Caller-specific markup belongs in a custom part or a slot.

## When to use this package

Use it to render a whole HTML email, to run a batch of templates that share one props type, and to see which part broke. Use `defineTemplate` when the document is not the email shell. For MJML, a CSS inliner, or a React email renderer, use a different package in the LLazyEmail org.
