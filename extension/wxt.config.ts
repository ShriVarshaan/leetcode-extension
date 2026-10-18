import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'LeetCode Revision Buddy',
    description: 'Daily spaced-repetition revision for LeetCode',
    permissions: ['storage', 'alarms'],
    host_permissions: ['https://leetcode.com/*'],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
