import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/*/src/__tests__/**/*.test.ts',
      'packages/*/src/__tests__/**/*.pbt.test.ts',
      'patient-repo/__tests__/**/*.test.ts'
    ],
    globals: true,
    environment: 'node'
  }
});
