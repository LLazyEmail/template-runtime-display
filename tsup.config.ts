import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm', 'cjs', 'iife'],
  globalName: 'TemplateRuntimeDisplay',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true,
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : format === 'iife' ? '.global.js' : '.js',
    };
  },
});
