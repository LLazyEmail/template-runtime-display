import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { document as esmDocument } from '../dist/index.js';

const require = createRequire(import.meta.url);
const { document: cjsDocument } = require('../dist/index.cjs');

const sandbox = {};
vm.runInNewContext(
  readFileSync(new URL('../dist/index.global.js', import.meta.url), 'utf8'),
  sandbox,
);
const iifeDocument = sandbox.TemplateRuntimeDisplay?.document;

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
