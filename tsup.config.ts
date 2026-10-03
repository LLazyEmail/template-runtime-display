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
      escape: 'src/escape.ts',
      head: 'src/head.ts',
      body: 'src/body.ts',
      main: 'src/main.ts',
    },
    format: ['esm', 'cjs'],
    clean: false,
    outExtension({ format }) {
      return {
        js: format === 'cjs' ? '.cjs' : '.js',
      };
    },
  },
]);
