export type Command =
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'dev'; file: string; port: number; host: string; watch: string[] }
  | { kind: 'inspect'; file: string; out: string }
  | { kind: 'error'; message: string };

export const USAGE = `template-runtime-display: see which part of a template broke.

Usage
  template-runtime-display dev <module> [--port 4177] [--host 127.0.0.1] [--watch <dir>]...
  template-runtime-display inspect <module> [--out inspect.html]

  dev       Serve a live inspector. Saving the module, or anything it imports from
            a watched directory, reloads the page.
  inspect   Render once, write a self-contained HTML report, print the trace, and
            exit 1 if any part broke. Use it in CI.

The module exports \`template\` (an email template input, or a Template), and
optionally \`props\` and \`options\`. A .ts module needs Node 24 or later.

Options
  --port <n>     Port for dev. 0 picks a free one. Default 4177.
  --host <h>     Interface for dev. Default 127.0.0.1 (this machine only).
  --watch <dir>  Also watch this directory. Repeatable.
  --out <file>   Where inspect writes the report. Default inspect.html.
  -h, --help     Show this help.
  -v, --version  Show the version.
`;

function fail(message: string): Command {
  return { kind: 'error', message };
}

/** Read the command line. Pure, so every path can be tested without a process. */
export function parseArgs(argv: readonly string[]): Command {
  const [name, ...rest] = argv;
  if (name === undefined || name === '-h' || name === '--help' || name === 'help') {
    return { kind: 'help' };
  }
  if (name === '-v' || name === '--version') return { kind: 'version' };
  if (name !== 'dev' && name !== 'inspect') {
    return fail(`Unknown command "${name}". Run with --help to see the commands.`);
  }

  let file: string | undefined;
  let port = 4177;
  let host = '127.0.0.1';
  let out = 'inspect.html';
  const watch: string[] = [];

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i] as string;
    if (arg === '-h' || arg === '--help') return { kind: 'help' };

    if (!arg.startsWith('-')) {
      if (file !== undefined) return fail(`Unexpected extra argument "${arg}".`);
      file = arg;
      continue;
    }

    const eq = arg.indexOf('=');
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const allowed = name === 'dev' ? ['--port', '--host', '--watch'] : ['--out'];
    if (!allowed.includes(flag)) return fail(`Unknown option "${flag}" for ${name}.`);

    const value = eq === -1 ? rest[(i += 1)] : arg.slice(eq + 1);
    if (value === undefined || value === '') return fail(`Option ${flag} needs a value.`);

    if (flag === '--port') {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
        return fail(`Invalid port "${value}". Use a number from 0 to 65535.`);
      }
      port = parsed;
    } else if (flag === '--host') {
      host = value;
    } else if (flag === '--watch') {
      watch.push(value);
    } else {
      out = value;
    }
  }

  if (file === undefined) return fail(`${name} needs a module path. Example: ${name} ./letter.mjs`);
  return name === 'dev' ? { kind: 'dev', file, port, host, watch } : { kind: 'inspect', file, out };
}
