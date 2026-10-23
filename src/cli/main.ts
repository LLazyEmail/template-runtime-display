#!/usr/bin/env node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { USAGE, parseArgs } from './args';
import { inspectCommand } from './commands';
import { forkRender } from './fork';
import { startServer } from './server';

// Command line bootstrap. Everything it calls is tested; this file only wires them to the process.
const command = parseArgs(process.argv.slice(2));
const workerPath = fileURLToPath(new URL('./worker.js', import.meta.url));
const log = (line: string): void => void process.stdout.write(`${line}\n`);

switch (command.kind) {
  case 'help':
    log(USAGE);
    break;

  case 'version': {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    log(pkg.version);
    break;
  }

  case 'error':
    process.stderr.write(`${command.message}\n`);
    process.exitCode = 2;
    break;

  case 'inspect':
    process.exitCode = await inspectCommand(resolve(command.file), command.out, {
      render: (file) => forkRender(file, { workerPath }),
      write: (file, contents) => writeFile(file, contents, 'utf8'),
      log,
    });
    break;

  case 'dev': {
    const file = resolve(command.file);
    try {
      const server = await startServer({
        file,
        port: command.port,
        host: command.host,
        watchDirs: command.watch.map((dir) => resolve(dir)),
        render: (target) => forkRender(target, { workerPath }),
      });
      log(`Inspecting ${command.file}`);
      log(`  ${server.url}   (live reload on save, Ctrl+C to stop)`);
      log(`  ${server.url}email   the finished document alone`);
      process.once('SIGINT', () => void server.close().then(() => process.exit(0)));
    } catch (error) {
      const code = (error as { code?: string }).code;
      process.stderr.write(
        code === 'EADDRINUSE'
          ? `Port ${command.port} is already in use. Try --port 0 to pick a free one.\n`
          : `Could not start the dev server: ${String(error)}\n`,
      );
      process.exitCode = 1;
    }
    break;
  }
}
