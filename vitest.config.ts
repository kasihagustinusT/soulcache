import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@soulcache/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@soulcache/react': path.resolve(__dirname, 'packages/react/src/index.ts'),
      '@soulcache/devtools-core': path.resolve(__dirname, 'packages/devtools-core/src/index.ts'),
      '@soulcache/devtools': path.resolve(__dirname, 'packages/devtools/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['node_modules', '**/node_modules/**', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/core/src/**/*.ts', 'packages/devtools-core/src/**/*.ts'],
      exclude: ['packages/*/src/**/*.test.ts', 'packages/*/src/**/*.spec.ts'],
      thresholds: {
        statements: 87,
        branches: 85,
        functions: 90,
        lines: 87,
      },
    },
  },
});
