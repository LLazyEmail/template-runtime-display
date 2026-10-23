import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import {
  document as esmDocument,
  explain as esmExplain,
  renderEmail as esmRenderEmail,
} from '../dist/index.js';

const require = createRequire(import.meta.url);
const {
  document: cjsDocument,
  explain: cjsExplain,
  renderEmail: cjsRenderEmail,
} = require('../dist/index.cjs');

const sandbox = {};
vm.runInNewContext(
  readFileSync(new URL('../dist/index.global.js', import.meta.url), 'utf8'),
  sandbox,
);
const iife = sandbox.TemplateRuntimeDisplay;
const iifeDocument = iife?.document;

const builds = [
  ['esm', esmDocument],
  ['cjs', cjsDocument],
  ['iife', iifeDocument],
];

for (const [name, document] of builds) {
  if (typeof document !== 'function') {
    console.error(`${name} build did not export document`);
    process.exit(1);
  }
  const html = document();
  if (
    !html.startsWith('<!DOCTYPE html>') ||
    !html.includes('<html lang="en">') ||
    html.includes('undefined')
  ) {
    console.error(`${name} build rendered an unexpected document`);
    process.exit(1);
  }
}

const runtimes = [
  ['esm', esmRenderEmail, esmExplain],
  ['cjs', cjsRenderEmail, cjsExplain],
  ['iife', iife?.renderEmail, iife?.explain],
];

for (const [name, renderEmail, explain] of runtimes) {
  if (typeof renderEmail !== 'function' || typeof explain !== 'function') {
    console.error(`${name} build did not export the runtime`);
    process.exit(1);
  }
  const result = renderEmail({ id: 'smoke' });
  const report = explain(result);
  if (!result.ok || !result.html.startsWith('<!DOCTYPE html>') || !report.includes('smoke: ok')) {
    console.error(`${name} build rendered an unexpected email`);
    process.exit(1);
  }
}

// The CLI and its worker run from the build, as an installed package would run them.
const { spawnSync } = await import('node:child_process');
const { mkdtempSync, readFileSync: read, rmSync, writeFileSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const { join } = await import('node:path');
const cli = new URL('../dist/cli.js', import.meta.url).pathname;
const work = mkdtempSync(join(tmpdir(), 'trd-smoke-'));

try {
  const letter = (render) =>
    `export const template = { id: 'smoke', parts: [{ id: 'note', render: ${render} }] };`;
  const good = join(work, 'good.mjs');
  const bad = join(work, 'bad.mjs');
  writeFileSync(good, letter(`() => '<p>ok</p>'`));
  writeFileSync(bad, letter(`() => { throw new Error('boom'); }`));

  const runs = [
    ['clean render exits 0', ['inspect', good, '--out', join(work, 'good.html')], 0, /smoke: ok/],
    [
      'broken part exits 1',
      ['inspect', bad, '--out', join(work, 'bad.html')],
      1,
      /note error .*boom/,
    ],
    [
      'missing module exits 2',
      ['inspect', join(work, 'nope.mjs'), '--out', join(work, 'x.html')],
      2,
      /Could not render/,
    ],
    ['bad command exits 2', ['bogus'], 2, /Unknown command/],
  ];
  for (const [name, args, code, pattern] of runs) {
    const run = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    if (run.status !== code || !pattern.test(run.stdout + run.stderr)) {
      console.error(`cli: ${name} failed (exit ${run.status})\n${run.stdout}${run.stderr}`);
      process.exit(1);
    }
  }
  if (!read(join(work, 'bad.html'), 'utf8').includes('1 part broke')) {
    console.error('cli: the report did not name the broken part');
    process.exit(1);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
