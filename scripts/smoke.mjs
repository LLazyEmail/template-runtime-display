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
