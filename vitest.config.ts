import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/runtime/types.ts',
        'src/templates/email/types.ts',
        'src/templates/document/index.ts',
        // Process entry points. scripts/smoke.mjs runs them from the build.
        'src/cli/main.ts',
        'src/cli/worker.ts',
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
