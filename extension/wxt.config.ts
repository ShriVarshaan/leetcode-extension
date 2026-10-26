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
    // `identity` is only used by Google sign-in; store reviewers reject unused permissions.
    permissions: [
      'storage',
      'alarms',
      'notifications',
      ...(process.env.WXT_GOOGLE_SIGN_IN === 'true' ? ['identity'] : []),
    ],
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
  // The Firefox sources zip for AMO review needs the workspace root (lockfile, workspace config).
  // Dotfiles such as .env are skipped by default.
  zip: {
    sourcesRoot: '..',
    includeSources: [
      'extension/**',
      'scripts/package.json',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'SOURCE_CODE_REVIEW.md',
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
