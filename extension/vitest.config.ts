import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    dir: '..',
    include: ['extension/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.output/**', '**/.wxt/**'],
  },
});
