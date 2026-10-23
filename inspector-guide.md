# Inspector guide

The inspector shows what a render did: which part ran, what each one produced, which one broke, and how the finished email will look and weigh. This page covers the report, the live dev server, the JSON trace, and the first two email quality checks (size and plain text).

- [The report](#the-report)
- [Live dev server](#live-dev-server)
- [One-shot report for CI](#one-shot-report-for-ci)
- [JSON trace](#json-trace)
- [Size check](#size-check)
- [Plain-text version](#plain-text-version)
- [Light and Dark preview](#light-and-dark-preview)
- [From code](#from-code)
- [What it does not do](#what-it-does-not-do)

## The report

`inspect(result)` returns one HTML page. It has no scripts and makes no network requests, so it is safe to attach to a CI run or send to a teammate.

| Section                    | What it shows                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Header                     | Template id, `OK` or `FAILED`, part count, size, total time, slowest part                                                                 |
| Banner                     | Each broken part with its error, or the compose error, or the part that threw. Links to the part card.                                    |
| Output by part             | A bar per part sized by its output, with status, characters and time                                                                      |
| Changes (with `compareTo`) | Which parts changed since an earlier render, and the changed lines                                                                        |
| Document                   | The finished email in a sandboxed frame at Full, Tablet 768 and Mobile 375, in Light or Dark                                              |
| Size                       | Bytes against the Gmail clip limit, a meter, the largest parts, and warnings                                                              |
| Plain-text version         | What `toText` makes of the document, ready to select and copy                                                                             |
| Parts                      | One card per part: status, a sandboxed preview, and the source. Broken parts open by default. Previous and next links move between cards. |

Safety: every id, message and title is escaped. Part and document HTML appear only inside `<iframe sandbox="">` and escaped `<pre>` blocks, so a hostile part cannot run code in the report. Click a source block and the whole block is selected, ready to copy.

## Live dev server

```bash
npx template-runtime-display dev ./letter.mjs
```

The module exports `template` (an email template input or a `Template`) and optionally `props` and `options`.

- `/` is the inspector. It reloads when the module, or anything under its directory, changes. Add directories with `--watch <dir>`.
- After an edit that changes the output, the page lists which parts changed and shows the changed lines.
- `/email` is the finished document alone.
- `/trace.json` is the render as data (see below).
- Each render runs in a fresh child process with a 10 second limit, so edits are always picked up and a module that crashes or loops forever shows an error page instead of stopping the server.
- It binds to `127.0.0.1` and answers `403` to any request whose `Host` header is not loopback, which blocks DNS-rebinding pages from reaching it.
- The CLI renders with `onError: 'collect'` so one broken part does not hide the rest. Set `options.onError` in the module to change that.

Try it: `npm run demo` serves `examples/inspect-demo.mjs`, which has a broken part on purpose. Fix `promoCode`, save, and watch the part turn green and the change appear.

## One-shot report for CI

```bash
npx template-runtime-display inspect ./letter.mjs --out report.html --json trace.json
```

| Exit code | Meaning                                                                 |
| --------- | ----------------------------------------------------------------------- |
| `0`       | Every part rendered                                                     |
| `1`       | A part broke, or the render threw                                       |
| `2`       | The module could not be rendered (syntax error, no `template`, timeout) |

Both files are written in every case, so CI can upload them as artifacts. A crash writes `{ "ok": false, "crash": { "message", "detail"? } }` to the JSON file so a script can always read it. A closed pipe (`... | head`) does not crash the CLI or change its exit code.

## JSON trace

`traceJson(resultOrRenderError, { html? })` returns the render as plain data, and `traceJsonText` returns it as pretty JSON. The shape is stable, so scripts and CI can depend on it.

```json
{
  "templateId": "weekly-digest",
  "ok": false,
  "size": { "bytes": 993, "limit": 104448, "clipRisk": "ok", "warnings": [] },
  "parts": [
    { "id": "head", "status": "ok", "chars": 447, "bytes": 447, "ms": 0.02 },
    {
      "id": "promo",
      "status": "error",
      "chars": 0,
      "bytes": 0,
      "ms": 0.05,
      "error": { "name": "TypeError", "message": "Cannot read properties of undefined" }
    }
  ]
}
```

`threw: { partId, message }` is present when the render threw, and `composeError` when `compose` failed. Pass `{ html: true }` to include each part's markup and the document. `bytes` is the UTF-8 size, which is what mail clients count; `chars` is `.length`.

## Size check

Gmail clips a message whose HTML is over about 102 KB and hides the rest behind "View entire message". That hides the footer and the unsubscribe link, which hurts deliverability and breaks bulk-sender rules.

```ts
import { measureSize } from '@llazyemail/template-runtime-display/quality';

const size = measureSize(result);
size.clipRisk; // 'ok' | 'near' | 'over'
size.perPart; // [{ id, bytes }] largest first
size.clippedParts; // parts that start after the clip point
size.unsubscribeClipped; // true when the unsubscribe link is after it
size.warnings; // sentences ready to show
```

- Size is the UTF-8 byte length of the final document, not `.length`. `€` is 3 bytes.
- `near` starts at 80 KB, `over` above 102 KB. Both are options: `measureSize(result, { limit, nearLimit })`.
- Which parts are "hidden by the clip" is found by locating each part's output in the document, so a part whose output the `compose` function rewrites may not be listed.

## Plain-text version

A `text/plain` alternative part improves spam scores and serves readers who prefer text. `toText` makes one from the HTML, with no DOM and no dependency.

```ts
import { toText } from '@llazyemail/template-runtime-display/quality';

toText(result.html); // wrapped at 78 columns
toText(result.html, { width: 0 }); // no wrapping
```

| In the HTML                                                      | In the text                                        |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| `<h1>`..`<h6>`                                                   | Uppercase line with blank lines around it          |
| `<p>`, `<div>`, table rows                                       | Paragraphs separated by a blank line               |
| `<li>`                                                           | `- item`, wrapped lines indented                   |
| `<a href="u">label</a>`                                          | `label (u)`, or just `u` when the label is the URL |
| `<img alt="x">`                                                  | `[x]`. Images without alt text are dropped         |
| `<span class="preheader">`                                       | First line                                         |
| `<head>`, `<style>`, `<script>`, comments, `display:none` blocks | Dropped                                            |
| `&amp;`, `&mdash;`, `&#8364;`                                    | Decoded                                            |

It reads the markup this package generates (headings, paragraphs, lists, links, tables), not arbitrary HTML. Links whose `href` is empty, `#` or `javascript:` print only their label.

## Light and Dark preview

The Document section has a Light and a Dark choice next to the width choices. Each choice shows its own frame with the color scheme pinned on the root element, so the result is the same whatever your system setting is.

This previews a client that supports `color-scheme`: the default canvas and text colors change. It does not run your own `@media (prefers-color-scheme: dark)` rules, because those follow the system setting. To see them, change your system setting. Emails with hard-coded `#fff` backgrounds stay white in both, which is exactly what you would see in a client that does not invert colors.

## From code

```ts
import {
  diffRenders,
  formatDiff,
  inspect,
  renderEmail,
  traceJsonText,
} from '@llazyemail/template-runtime-display';

const before = renderEmail(template, props, { onError: 'collect' });
const after = renderEmail(template, { ...props, code: 'save20' }, { onError: 'collect' });

writeFileSync('report.html', inspect(after, { compareTo: before }));
writeFileSync('trace.json', traceJsonText(after));
console.log(formatDiff(diffRenders(before, after)));
```

`inspect`, `traceJson`, `diffRenders`, `measureSize` and `toText` are pure. None does I/O.

## What it does not do

- It does not render in real mail clients. The preview is your browser. Outlook for Windows renders with Word and will differ.
- It does not lint markup for client compatibility yet. That is the next piece of the [email quality toolkit](./email-quality-toolkit.md).
- The dev server renders one module. It is a development tool, not a production server.
