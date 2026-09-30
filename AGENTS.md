# Agent notes for template-runtime-display

`@llazyemail/template-runtime-display` builds an HTML email as pure functions of plain props. Each function returns a string. No DOM, no I/O, no runtime dependencies. The package is stateless, so loading the ESM and CJS builds in one process is safe.

## Commands

```bash
npm install
npm run dev            # tsup --watch
npm run build          # dist/index.js, dist/index.cjs, dist/index.global.js, dist/index.d.ts
npm test               # vitest run — src/**/*.test.ts
npm run test:coverage  # v8 coverage; fragment files must stay at 100%
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run lint:fix
npm run format         # prettier --write
npm run format:check
npm run generate       # build, then write generated/letter.html via markup-generator
npm run publint        # export and types check; requires dist/
npm run smoke          # load the ESM, CJS, and IIFE builds; requires dist/
npm run check          # format, lint, typecheck, build, test, smoke, publint
```

Node.js **24+**. Run `npm run check` before handing work back. Run `npm run test:coverage` when you add or change a fragment.

ESLint and Prettier both run in CI. Tests are Vitest, not Jest. `markup-generator` is a devDependency used to write rendered HTML in `src/write.test.ts` and `npm run generate`. It is not a runtime dependency.

## Layout

```
src/index.ts           public exports only — consumers import the package root
src/head.ts            head()
src/main.ts            main()
src/footer.ts          footer()
src/body.ts            body()
src/content.ts         content()
src/document.ts        document()
src/index.test.ts      behavior spec
examples/compose.ts    sample letter; sampleHtml is covered by the suite
src/write.test.ts      writes a letter through markup-generator and reads it back
scripts/generate.mjs   writes generated/letter.html
.github/workflows/ci.yml
.github/workflows/publish.yml   GitHub Packages on release, or a manual run
llms.txt               short index for agents
llms-full.txt          props, omission rules, composition
tsup.config.ts         ESM + CJS + IIFE, dts, sourcemaps
vitest.config.ts
```

Do not add a second entry point. Do not add `src/**/*.js` next to a `.ts` file.

## Invariants

- Every public function is `(props?) => string`. Named exports only. No default export.
- The same input returns the same string, including whitespace.
- Omitted optional strings render as empty strings. Output must not contain the word `undefined`.
- `main` emits the CTA `<a>` only when both `ctaLabel` and `ctaUrl` are set.
- `footer` emits `Unsubscribe` only when `unsubscribeUrl` is set.
- `document` starts with `<!DOCTYPE html>`, then `<html lang="en">`. `lang` stays `en`.
- `head` always emits charset `utf-8`, the viewport meta, a `<title>`, and the hidden preview `<div>`.
- Props are interpolated raw. This package has no escape step. Keep it that way unless the task asks for escaping.
- `bodyText` and `content` are allowed to contain HTML.
- Zero runtime dependencies. Dev tooling stays in `devDependencies`.
- Public types ship from `src/index.ts` through tsup `dts`. Keep `tsconfig` `types` empty so `@types/node` cannot leak into `.d.ts`.

## Add a fragment

1. Add `src/<name>.ts` with a props interface (JSDoc on each field) and one function. Default omitted strings to `''`.
2. Re-export the function and the type from `src/index.ts`.
3. Extend `src/index.test.ts`: default render, each omission rule, and the filled-in render.
4. Add the function to `README.md`, `llms.txt`, and `llms-full.txt`.
5. Run `npm run check` and `npm run test:coverage`.

## When to use this package

Use it to assemble a small HTML email from these fragments. For MJML, a CSS inliner, or a React email renderer, use a different package in the LLazyEmail org.
