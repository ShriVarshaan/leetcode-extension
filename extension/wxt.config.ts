import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // MV3 everywhere, including Firefox (WXT defaults Firefox to MV2, which has no `browser.action`).
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'LeetCode Revision Buddy',
    description: 'Daily spaced-repetition revision for LeetCode',
    permissions: ['storage', 'alarms', 'notifications', 'identity'],
    host_permissions: ['https://leetcode.com/*'],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'leetcode-revision-buddy@shrivarshaan',
          strict_min_version: '140.0',
          // Sent to the extension's own backend: the account email and LeetCode solve history.
          data_collection_permissions: { required: ['personallyIdentifyingInfo', 'websiteActivity'] },
        },
      },
    }),
  }),
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
