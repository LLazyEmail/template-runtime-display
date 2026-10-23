## Email quality toolkit: lint, plain text, dark mode and size checks on every render

### Status

Shipped (see [docs/inspector.md](./inspector.md)):

- [x] `toText(html)`: plain-text version
- [x] `measureSize(result)`: UTF-8 size, Gmail 102 KB clip risk, parts hidden by the clip, unsubscribe-after-clip warning
- [x] Inspector: size section, plain-text section, Light / Dark preview
- [x] `traceJson`, `inspect --json`, and `/trace.json`
- [x] Subpath export `@llazyemail/template-runtime-display/quality`

Still to do: `lintEmail` and its rules, the dark-mode contrast and image rules, `renderEmail(..., { check: true })` and `result.quality`, `inspect --fail-on`, and findings in the inspector.

Decisions made while building the first slice:

- The functions are pure and exported on their own, so they work on any `RenderResult` today. `result.quality` can wrap them later without changing them.
- The Light / Dark toggle pins `color-scheme` on the root of each previewed document instead of relying on the frame, because a frame follows the viewer's system setting. It does not run `prefers-color-scheme` rules. The dark-mode rules planned below must therefore analyse the CSS rather than rely on the preview.

### Why

The runtime answers "which part broke?" (a part threw). It does not answer the question that actually costs email teams money: **"which part will break in the inbox?"** An email can render with `ok: true` and still be clipped by Gmail, unreadable in Outlook, or blank in dark mode. Today every one of those is found by sending a test and squinting.

The inspector (live dev server and `inspect` report) now gives us a place to show findings next to the part that caused them. This issue proposes the checks that fill it.

Goal: `result.quality` exists on every render, each finding names the **part** it came from, and `inspect` shows them. No new runtime dependencies in the library.

### Proposed scope

Ship as four independent pieces, each its own PR, so any can land without the others.

#### 1. Client-compatibility linter (`lintEmail`)

`lintEmail(result): Finding[]`, pure, string in, findings out.

```ts
interface Finding {
  rule: string; // 'no-flex-layout'
  severity: 'error' | 'warn' | 'info';
  partId?: string; // which part produced it, from the trace
  message: string; // what is wrong, in one line
  fix?: string; // what to do instead
  clients?: string[]; // ['outlook-windows', 'gmail-android']
  excerpt?: string; // the offending markup, trimmed
}
```

First rules (each is one small function plus tests with a passing and a failing fixture):

| Rule                     | Catches                                                   | Why it matters                                          |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------------- |
| `no-flex-grid-layout`    | `display:flex`, `display:grid`, `float` used for layout   | Outlook for Windows renders with Word; layout collapses |
| `no-external-stylesheet` | `<link rel=stylesheet>`                                   | Stripped by most clients                                |
| `no-script-or-form`      | `<script>`, `<form>`, `<iframe>`, `<video>`               | Removed or blocked; a form is a deliverability risk     |
| `style-in-head-only`     | critical styles only in `<style>` with no inline fallback | Gmail drops `<style>` in some account types             |
| `img-needs-alt-and-size` | `<img>` without `alt`, `width`, `height`                  | Blocked images collapse the layout; spam-filter signal  |
| `no-svg-background`      | SVG images and CSS `background-image` for key content     | Not supported in Outlook / some Gmail                   |
| `button-needs-table`     | `<a>` styled as a button with padding only                | Padding is ignored on `<a>` in Outlook                  |
| `link-hygiene`           | `href` empty, `#`, `javascript:`, or missing `https`      | Broken links, mixed-content warnings                    |
| `preheader-length`       | preview text under ~40 or over ~110 chars                 | Inbox shows the preheader after the subject             |
| `html-lang-and-title`    | missing `lang`, empty `<title>`                           | Accessibility and some client rendering                 |
| `unsubscribe-present`    | no unsubscribe link in a marketing template               | Required by Gmail/Yahoo bulk-sender rules and CAN-SPAM  |

Rules take the final document **and** per-part HTML, so the finding can say `promo` rather than "somewhere in the email". Rules are plain functions in a list, so callers can add their own. No registry; `lintEmail(result, { rules })` accepts an array.

Source of truth for client support: link each rule to the matching caniemail.com feature page in its `fix` text rather than copying a support table into the repo.

#### 2. Plain-text version (`toText`)

`toText(html): string`, with no DOM and no dependency.

- Headings become uppercase lines, paragraphs are blank-line separated, lists become `- item`.
- `<a href="u">label</a>` becomes `label (u)`, and a link whose label equals the URL is printed once.
- Hidden preheader text is kept as the first line, `<style>`, `<head>`, and `display:none` blocks are dropped.
- Wrap at 78 columns. Decode entities. Collapse whitespace.
- A missing text/plain part is a spam-score penalty, and many people read plain text, so ship it as `result.text` or export it for callers to attach as the alternative part.

Tests: round-trip against the existing letter fixtures and a snapshot of the preset shell.

#### 3. Dark-mode checks and preview

The shell already emits `color-scheme: light dark` meta. Nothing verifies the content survives it.

- Rule `dark-mode-contrast`: parse inline `color` / `background(-color)` pairs, flag combinations that fall below WCAG AA (4.5:1) in either scheme, and flag hard-coded `#fff` backgrounds with no `prefers-color-scheme` override.
- Rule `dark-mode-images`: images with transparent backgrounds and dark artwork get a warning prompt, since a PNG logo can vanish on a dark canvas.
- Inspector: a **Light / Dark** toggle on the document preview. Done: each choice shows its own frame with `color-scheme` pinned on the root (see Status).

#### 4. Size and clipping budget

Gmail clips messages over ~102 KB of HTML, and the "View entire message" link hides the unsubscribe footer and tracking pixel.

- `result.quality.size = { bytes, clipRisk: 'ok' | 'near' | 'over', perPart }` using the UTF-8 byte length, not `.length`.
- Per-part bytes make the heavy part obvious; the inspector's bar chart already sizes bars by output, so add the 102 KB line and a "near" band at 80 KB.
- Warn when the footer or unsubscribe falls after the 102 KB mark, because that is the part that gets clipped.

### Integration

- `renderEmail(..., { check: true })` attaches `result.quality = { findings, size, text }`. Off by default so existing output and timings are unchanged (keeps the "same input, same HTML" invariant).
- `inspect()` renders findings as a section, with each finding linked to its part card, ordered by severity.
- `inspect` CLI gets `--fail-on warn|error` (default `error`). That is the CI hook: exit 1 when a finding at or above the level exists. Today the exit code only reflects thrown parts.
- Subpath export `@llazyemail/template-runtime-display/quality` so the checks tree-shake and the core stays small.
- Dev server: findings update live on save, and the "Changes since previous render" section also lists findings that appeared or disappeared.

### Constraints (from AGENTS.md)

- Zero runtime dependencies: HTML is scanned with small tokenizers and regexes over the markup we generate, not a DOM library. Document that this is a linter for emails (mostly table markup and inline styles), not a general HTML parser, and keep a list of known blind spots in the README.
- No template registry. Rules are an array of functions passed in.
- `escapeHtml` is still not applied to props. The linter should _report_ unescaped `<` and `&` in text positions rather than fixing them.
- 100% coverage on new executable files.

### Out of scope

- Rendering screenshots in real mail clients (needs a paid service or a browser farm).
- CSS inlining or MJML compilation. Those belong to other packages in the org.
- Auto-fixing markup. Findings suggest fixes; they do not rewrite.

### Acceptance criteria

- [ ] `lintEmail` with the first eight rules above, each with a passing and a failing fixture
- [ ] Every finding carries the `partId` it came from when the markup is in a part
- [x] `toText` handles headings, lists, links, entities, hidden text, and wrapping, with tests
- [ ] `renderEmail(..., { check: true })` returns `quality`; default output is byte-identical to today
- [ ] Dark-mode contrast rule (the Light/Dark preview toggle is done)
- [x] Size budget with UTF-8 bytes and footer-clipping warning
- [ ] Inspector section for findings; CLI `--fail-on`
- [ ] README, AGENTS.md, llms.txt, llms-full.txt updated; `npm run check` green

### Suggested order

1. ~~Size budget and `toText`~~: shipped.
2. Linter core and the first rules, with inspector section and `--fail-on`.
3. Dark mode.
4. Remaining rules, driven by what real templates in the org trip over. Run the linter over the existing LLazyEmail templates first and keep only rules that find something real.

### Open questions

- Should `check` default to on for the `inspect` CLI, even though it is off for the library call?
- Do we want rule severity configurable per call (`{ rules: { 'link-hygiene': 'off' } }`)?
- Is 102 KB the right default budget, or should it follow a per-client table?
