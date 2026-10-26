# Building the Firefox package from source

For add-on reviewers. Builds `leetcode-revision-buddy-<version>-firefox.zip` from this source archive.

## Requirements

- Node.js 22.18 or later (tested with 24.12)
- pnpm 10 or later (tested with 12.14): `npm install -g pnpm`

Tested on Windows 11. It should build the same way on macOS and Linux.

## Steps

1. Create `extension/.env` with the two public values given in the reviewer notes:

   ```
   WXT_SUPABASE_URL=...
   WXT_SUPABASE_ANON_KEY=...
   ```

   These are the public Supabase project URL and anon key, which are also visible in the built bundle. Row-level security protects the data.

2. From the root of the archive, run:

   ```sh
   pnpm install --frozen-lockfile
   pnpm zip:firefox
   ```

The package is written to `extension/.output/leetcode-revision-buddy-<version>-firefox.zip`, and the unpacked build to `extension/.output/firefox-mv3/`.

## Notes

- The bundler is [WXT](https://wxt.dev) (Vite). The source is TypeScript and React in `extension/`.
- No code is loaded remotely. The extension talks to its own Supabase backend and to leetcode.com.
