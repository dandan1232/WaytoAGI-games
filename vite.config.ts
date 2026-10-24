import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  test: { include: ['tests/**/*.test.ts'] },
  build: {
    rolldownOptions: {
      output: { manualChunks: (id) => id.includes('node_modules/three') ? 'three' : undefined },
    },
  },
});
