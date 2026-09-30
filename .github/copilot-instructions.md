# Copilot instructions for template-runtime-display

`@llazyemail/template-runtime-display` exports pure functions that return HTML email fragments. Zero runtime dependencies. Follow [AGENTS.md](../AGENTS.md).

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

Vitest, `src/**/*.test.ts` only. Coverage via `@vitest/coverage-v8`.

## Editing

One fragment per file under `src/`. Re-export from `src/index.ts`. Omitted strings render empty. The CTA needs both label and url. Unsubscribe needs a url. Props are raw HTML. `document` keeps `<html lang="en">` and a leading `<!DOCTYPE html>`.
