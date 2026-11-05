import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './', // relative asset paths, so the build works on static hosts such as GitHub Pages
  worker: { format: 'es' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
