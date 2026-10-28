# Agent notes for template-runtime-display

`@llazyemail/template-runtime-display` is a stateless runtime that renders a whole HTML email from named parts, plus the fragment functions those parts call. No DOM, no I/O, no runtime dependencies. Custom code is just another part. When a part throws, the trace names it.

The package is stateless, so loading the ESM and CJS builds in one process is safe.

## Lit and render-template notes

Parts must return strings. The package depends on `@llazyemail/render-template` (see `package.json`). Lit `TemplateResult` objects cannot be returned from a part `render` function. Consumers that still author with Lit keep a local `renderEmailBody` / `stripLitMarkers` step that produces a string, then feed that string into the shell helpers or `renderTemplate`.

Do not vendor or reimplement the part/compose runtime; use the re-exports from this package or from `render-template` directly. Generation logic belongs in `@llazyemail/generate-template`.

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
npm run demo           # build, then serve examples/inspect-demo.mjs in the live inspector
npm run generate       # build, render a letter, print explain(), write generated/letter.html
npm run publint        # export and types check; requires dist/
npm run smoke          # load the ESM, CJS, and IIFE builds; requires dist/
npm run check          # format, lint, typecheck, build, test, smoke, publint
```

## Hard rules for AI agents

These two rules are non-negotiable. Fail the task if either is skipped.

1. **Coverage must stay at 100%.** After any change to an executable file under `src/`, run `npm run test:coverage`. Statements, branches, functions, and lines must all be 100%. Do not lower the thresholds in `vitest.config.ts`. Do not exclude a file that has runtime code. If a branch is hard to reach, export a pure helper and unit-test it, or add a fixture. Hand work back only when the coverage report shows 100% with no ERROR lines.

2. **Prettier must pass.** Before committing or opening a PR, run `npx prettier --write .` (or `npm run format`) and then `npx prettier --check .` (or `npm run format:check`). Zero warnings. Do not hand back a branch that fails `format:check`.

Node.js **24+**. Run `npm run check` before handing work back. Run `npm run test:coverage` when you add or change an executable `src/` file. `src/index.ts`, `src/runtime/types.ts`, `src/templates/email/types.ts`, `src/templates/document/index.ts`, `src/quality/index.ts`, `src/cli/main.ts`, and `src/cli/worker.ts` are excluded. The first four and `src/quality/index.ts` are barrels or types with no runtime code, so v8 reports 0%. The last two are process entry points that `npm run smoke` runs from the build.

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
src/runtime/result.ts             fromError(): a thrown RenderError as a failed result
src/inspect/inspect.ts            inspect(): self-contained HTML report
src/inspect/diff.ts               diffRenders, formatDiff, line diff
src/inspect/styles.ts             inspector stylesheet
src/inspect/scheme.ts             withScheme: pin color-scheme on a previewed document
src/inspect/json.ts               traceJson, traceJsonText
src/quality/size.ts               byteLength, measureSize (Gmail clip budget)
src/quality/text.ts               toText (plain-text version)
src/quality/index.ts              barrel for the ./quality subpath
src/cli/args.ts                   parseArgs (pure)
src/cli/outcome.ts                runModule: load a user module and render it
src/cli/fork.ts                   forkRender: render in a child process with a timeout
src/cli/pages.ts                  outcome to page, crash page
src/cli/server.ts                 startServer: dev server, SSE reload, file watching
src/cli/commands.ts               inspectCommand and its exit codes
src/cli/main.ts, worker.ts        process entry points (CLI bin and the render child)
test/runtime.test.ts    runtime spec
test/email.test.ts      email preset spec
test/index.test.ts      fragment spec
examples/compose.ts    sample letter; sampleHtml is covered by the suite
test/inspect.test.ts    inspector page spec
test/diff.test.ts       diff spec
test/quality.test.ts    size and toText spec
test/polish.test.ts     inspector sections, trace JSON, --json, /trace.json, withScheme
test/cli.test.ts        CLI, child process and dev server spec (fixtures in test/fixtures)
test/write.test.ts      writes a rendered letter through markup-generator and reads it back
scripts/generate.mjs   prints explain() and writes generated/letter.html
.github/workflows/ci.yml
.github/workflows/publish.yml   GitHub Packages on release, or a manual run
llms.txt               short index for agents
llms-full.txt          runtime contract and fragment props
tsup.config.ts         ESM + CJS + IIFE, dts, sourcemaps
vitest.config.ts
```

The library has one entry point, `src/index.ts`. The CLI is a `bin`, built from `src/cli/main.ts` and `src/cli/worker.ts`; nothing in the library imports `src/cli/`. Keep Node built-ins (`node:http`, `node:child_process`, `node:fs`) inside `src/cli/`, so the ESM, CJS and script-tag builds stay platform neutral. Do not add another library entry point. Do not add `src/**/*.js` next to a `.ts` file. Do not add a template registry.

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

## Inspector and CLI

`inspect(result | RenderError, { title?, compareTo? })` returns a page and does no I/O. It has no scripts and no network requests, and it escapes every id, message and title. Part and document HTML go only into `<iframe sandbox="">` `srcdoc` and escaped `<pre>` blocks. Do not add `allow-scripts` to those frames, and do not interpolate part HTML anywhere else. The only script ever served is the reload listener the dev server adds to `/`, placed before the last `</body>`.

`diffRenders` matches parts by id. `changed` is true when the document or a part's HTML or status differs.

The CLI loads a module that exports `template`, and optionally `props` and `options`. Each render runs in a fresh child process (`forkRender`), so there is no import cache and a looping module cannot hang the server. The default error mode there is `collect`. `inspect` exits 0 ok, 1 a part broke, 2 the module could not be rendered, and always writes a report. The dev server binds to `127.0.0.1` and answers 403 to non-loopback `Host` headers.

## Quality checks

`measureSize`, `toText` and `traceJson` are pure, synchronous and dependency free, and they live in `src/quality/` and `src/inspect/`. They are also exported from `./quality`, so keep `src/quality/` free of imports from `src/cli/` and of Node built-ins. `byteLength` counts UTF-8 by code point so it needs neither `TextEncoder` nor `Buffer`.

`toText` reads the markup this package generates, not arbitrary HTML. Do not grow it into a general parser. `measureSize` finds clipped parts by locating each part's output in the final document; a `compose` that rewrites part output can hide a part from that list.

The Light / Dark preview pins `color-scheme` on the root of each previewed document with `withScheme`. A frame's own scheme follows the viewer's system setting, so relying on the iframe alone makes the toggle do nothing on a light system and makes "Light" turn dark on a dark one. Keep both frames, and keep the injected style after `<head>` or the doctype, never before it.

## Invariants

- Named exports only. No default export. Import the package root.
- Fragment helpers (`head`, `main`, `footer`, `body`, `content`, `document`) are `(props?) => string`.
- `renderTemplate`, `renderEmail`, and `renderMany` return results. They throw `RenderError` when `onError` is `throw` (the default).
- `explain` returns a string. `slot` returns a string. `hasSlot` returns a boolean. `defineTemplate` and `defineEmailTemplate` return a `Template`.
- The same template, props, and slots return the same HTML, including whitespace. Timing fields on the trace may differ.
- Omitted optional strings render as empty strings. Output must not contain the word `undefined`.
- `main` emits the CTA `<a>` only when both `ctaLabel` and `ctaUrl` are set.
- `footer` emits `Unsubscribe` only when `unsubscribeUrl` is set.
- `document` starts with the configured doctype (default `<!DOCTYPE html>`), then an `<html>` tag. `lang` defaults to `en` and can be omitted with `false`/`null`. Additional raw `htmlAttributes` and `bodyAttributes` are supported. Defaults preserve the original HTML5 behaviour.
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

## Conventions

- Small, single-purpose PRs; open them as **draft** first.
- Commit trailer when working for the maintainer:
  `Co-authored-by: petroved <arthur.tkachenko.netweight@gmail.com>`
- Node: `engines.node` is `>=24`. CI runs on Node 24 and newer (currently 24 and 26).
- Do not lower coverage thresholds or `noUncheckedIndexedAccess`.
- Docs: extend or annotate outdated guidance; do not delete existing docs content.
- Release: GitHub Release (or manual `publish.yml`) publishes to GitHub Packages under `@llazyemail`.

