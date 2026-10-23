/// <reference types="node" />
import { watch } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname } from 'node:path';
import { URL } from 'node:url';
import type { RenderError } from '@llazyemail/render-template';
import type { RenderResult } from '../runtime/types';
import type { Outcome } from './outcome';
import { outcomePage, renderChanged, toInspectable } from './pages';

export interface DevServerOptions {
  /** The module to render on every request. */
  file: string;
  /** Renders the module. The CLI passes `forkRender`. */
  render: (file: string) => Promise<Outcome>;
  port?: number;
  /** Interface to bind. Default `127.0.0.1`, so only this machine can reach it. */
  host?: string;
  /** Extra directories to watch. The module's own directory is always watched. */
  watchDirs?: readonly string[];
  /** Quiet period after a file change before the page reloads. Default 60ms. */
  debounceMs?: number;
}

export interface DevServer {
  url: string;
  port: number;
  /** Tell every open page to reload, as if a watched file had changed. */
  reload: () => void;
  close: () => Promise<void>;
}

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);
const IGNORED = /(^|[\\/])(node_modules|\.git|dist|coverage)([\\/]|$)/;

const RELOAD_SCRIPT =
  "<script>(function(){var s=new EventSource('/__events');s.onmessage=function(){location.reload()}})()</script>";

/** Put the reload listener just before `</body>`. The inspector escapes part HTML, so the last match is ours. */
function withReload(html: string): string {
  const at = html.lastIndexOf('</body>');
  return at === -1
    ? html + RELOAD_SCRIPT
    : `${html.slice(0, at)}${RELOAD_SCRIPT}\n${html.slice(at)}`;
}

function send(res: ServerResponse, status: number, type: string, body: string): void {
  res.writeHead(status, {
    'content-type': `${type}; charset=utf-8`,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

/**
 * Serve the inspector for one module. Every page load renders the module
 * afresh, and a watched file change reloads open pages. The page for the
 * latest change also shows what that change did to the output.
 */
export function startServer(options: DevServerOptions): Promise<DevServer> {
  const host = options.host ?? '127.0.0.1';
  const clients = new Set<ServerResponse>();
  const watchers: FSWatcher[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  // What the last render looked like, and what it looked like before it last changed.
  let latest: RenderResult | RenderError | undefined;
  let previous: RenderResult | RenderError | undefined;

  const reload = (): void => {
    for (const client of clients) client.write('data: reload\n\n');
  };

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (LOOPBACK.has(host) && !isLoopbackHost(req.headers.host)) {
      send(res, 403, 'text/plain', 'Forbidden host');
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, 'text/plain', 'Method not allowed');
      return;
    }

    const path = new URL(req.url ?? '/', 'http://localhost').pathname;

    if (path === '/__events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      });
      res.write('retry: 500\n\n');
      clients.add(res);
      res.on('close', () => clients.delete(res));
      return;
    }

    if (path !== '/' && path !== '/email') {
      send(res, 404, 'text/plain', 'Not found');
      return;
    }

    const outcome = await options.render(options.file);
    const inspectable = toInspectable(outcome);
    if (inspectable) {
      if (latest && renderChanged(latest, inspectable)) previous = latest;
      latest = inspectable;
    }

    if (path === '/') {
      send(res, 200, 'text/html', withReload(outcomePage(outcome, previous)));
      return;
    }

    // `/email` is the finished document alone, for opening on its own or saving.
    const html = outcome.kind === 'result' ? outcome.result.html : '';
    if (html === '') {
      send(
        res,
        404,
        'text/plain',
        'No document: the render did not produce one. Open / to see why.',
      );
      return;
    }
    send(res, 200, 'text/html', html);
  };

  const server = createServer((req, res) => {
    handler(req, res).catch((error: unknown) => {
      send(res, 500, 'text/plain', `Dev server error: ${String(error)}`);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 4177, host, () => {
      server.off('error', reject);
      const { port } = server.address() as AddressInfo;
      const shownHost = host === '::1' ? '[::1]' : host;

      const dirs = new Set([dirname(options.file), ...(options.watchDirs ?? [])]);
      for (const dir of dirs) {
        watchers.push(
          watch(dir, { recursive: true }, (_event, name) => {
            if (name && IGNORED.test(String(name))) return;
            clearTimeout(timer);
            timer = setTimeout(reload, options.debounceMs ?? 60);
          }),
        );
      }

      resolve({
        url: `http://${shownHost}:${port}/`,
        port,
        reload,
        close: () =>
          new Promise<void>((done) => {
            clearTimeout(timer);
            for (const watcher of watchers) watcher.close();
            for (const client of clients) client.end();
            server.close(() => done());
            server.closeAllConnections();
          }),
      });
    });
  });
}

/** True for `localhost`, `127.0.0.1` and `[::1]` with any port. Blocks DNS-rebinding pages from reaching a local server. */
function isLoopbackHost(header: string | undefined): boolean {
  if (!header) return false;
  const host = header.startsWith('[')
    ? header.slice(0, header.indexOf(']') + 1)
    : header.split(':')[0];
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}
