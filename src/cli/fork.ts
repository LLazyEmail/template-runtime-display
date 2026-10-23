/// <reference types="node" />
import { fork } from 'node:child_process';
import { crash } from './outcome';
import type { Outcome } from './outcome';

export interface ForkOptions {
  /** Path to the worker script that reports an `Outcome` over IPC. */
  workerPath: string;
  /** Kill the render after this long. Default 10 seconds. */
  timeoutMs?: number;
  /** Program that runs the worker. Defaults to the current Node. */
  execPath?: string;
}

const STDERR_LIMIT = 8000;
/** Time to let a queued IPC message arrive when the child's exit is seen first. */
const EXIT_GRACE_MS = 50;

/**
 * Render a module in a fresh child process. A new process each time means
 * edited files are always re-read (no import cache), and a module that
 * crashes or loops forever cannot take the dev server down with it.
 */
export function forkRender(file: string, options: ForkOptions): Promise<Outcome> {
  const timeoutMs = options.timeoutMs ?? 10_000;

  return new Promise((resolve) => {
    const child = fork(options.workerPath, [file], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      ...(options.execPath ? { execPath: options.execPath } : {}),
    });
    let stderr = '';
    let settled = false;

    const finish = (outcome: Outcome): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      resolve(outcome);
    };

    const timer = setTimeout(
      () =>
        finish(crash(`Render timed out after ${timeoutMs}ms. Does a part loop forever?`, stderr)),
      timeoutMs,
    );

    child.stderr?.on('data', (chunk: Uint8Array) => {
      if (stderr.length < STDERR_LIMIT) stderr += String(chunk);
    });
    child.once('message', (message) => finish(message as Outcome));
    child.once('error', (error) => finish(crash(error.message, stderr)));
    child.once('exit', (code, signal) => {
      setTimeout(
        () =>
          finish(
            crash(
              `The render process ended before reporting (${signal ?? `exit code ${code}`}).`,
              stderr,
            ),
          ),
        EXIT_GRACE_MS,
      );
    });
  });
}
