import { defineConfig } from 'tsup';

const shared = {
  platform: 'neutral' as const,
  target: 'es2022' as const,
  dts: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  treeshake: true,
};

export default defineConfig([
  {
    ...shared,
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm', 'cjs', 'iife'],
    globalName: 'TemplateRuntimeDisplay',
    clean: true,
    outExtension({ format }) {
      return {
        js: format === 'cjs' ? '.cjs' : format === 'iife' ? '.global.js' : '.js',
      };
    },
  },
  {
    ...shared,
    entry: {
      escape: 'src/utils/escape.ts',
      head: 'src/templates/head/head.ts',
      body: 'src/templates/body/body.ts',
      main: 'src/templates/main/main.ts',
      document: 'src/templates/document/index.ts',
    },
    format: ['esm', 'cjs'],
    clean: false,
    outExtension({ format }) {
      return {
        js: format === 'cjs' ? '.cjs' : '.js',
      };
    },
  },
  {
    ...shared,
    platform: 'node' as const,
    entry: {
      cli: 'src/cli/main.ts',
      worker: 'src/cli/worker.ts',
    },
    format: ['esm'],
    dts: false,
    clean: false,
    // Keep the dependency external so the worker and the library share one RenderError class.
    external: ['@llazyemail/render-template'],
    outExtension: () => ({ js: '.js' }),
  },
]);
