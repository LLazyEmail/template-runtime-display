# Copilot instructions for template-runtime-display

`@llazyemail/template-runtime-display` is a stateless HTML renderer. `renderEmail` builds a whole email. `defineTemplate` is the same runtime for any other document. `explain` names the part that broke. Zero runtime dependencies. No template registry. Follow [AGENTS.md](../AGENTS.md).

## Commands

```bash
npm run build
npm test
npm run lint
npm run format:check
npm run typecheck
npm run check
```

## Tests

Vitest, `test/**/*.test.ts` only. Coverage via `@vitest/coverage-v8`. Executable `src` files stay at 100%. `src/index.ts` and `src/runtime/types.ts` are excluded.

## Editing

Fragment helpers stay `(props?) => string` and live one per folder under `src/templates/<name>/<name>.ts`. Shared helpers live in `src/utils/`. Re-export from `src/index.ts`. The runtime returns results and throws `RenderError` when `onError` is `throw`. Package-owned rejects throw `DisplayError` from `src/runtime/errors.ts`. Custom code is a part or a slot, not a new registry. Omitted strings render empty. The CTA needs both label and url. Unsubscribe needs a url. Props and slots are raw HTML. `document` keeps `<html lang="en">` and a leading `<!DOCTYPE html>`.
