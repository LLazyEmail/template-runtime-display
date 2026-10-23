/// <reference types="node" />
import { crash, runModule } from './outcome';

// Child process entry. The parent forks this with the module path and reads one
// message back. Nothing here is imported by the library, only run by `forkRender`.
const file = process.argv[2];
const outcome = file ? await runModule(file) : crash('No module path was given to the worker.');

if (process.send) {
  process.send(outcome, () => process.exit(0));
} else {
  process.stdout.write(`${JSON.stringify(outcome)}\n`);
}
