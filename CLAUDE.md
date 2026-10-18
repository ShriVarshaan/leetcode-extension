# LeetCode Revision Buddy

Chrome extension (WXT + React + TypeScript + Tailwind, Manifest V3) that recommends 3 LeetCode revision problems a day on topics the user has already solved. It uses topic-level spaced repetition (SM-2) and has an optional bring-your-own-key LLM picker. The backend is Supabase (Postgres + Auth + RLS). Full plan: `C:\Users\varsh\.claude\plans\i-want-to-make-nested-river.md`.

## Layout
- `extension/`: WXT app (`entrypoints/` for background, popup, options, content script; `lib/` for logic)
- `scripts/`: one-off scrapers and seed upload (Blind 75, NeetCode 150, Striver)
- `supabase/`: SQL migrations and seed data

## Rules
- The user's LLM API key lives only in `chrome.storage.local`. Never send it to Supabase or log it.
- The Supabase service-role key is only for `scripts/` (via `.env`). Never put it in `extension/`.
- Every user table has RLS: `user_id = auth.uid()`.
- All leetcode.com calls go through `extension/lib/leetcode.ts`.
- The LLM only chooses from a deterministic candidate list. Validate its output and fall back to `fallbackPick` on failure.
- Keep `srs.ts` and `candidates.ts` as pure functions with Vitest tests.
- Store only problem metadata (slug, title, difficulty, tags, URL), never problem statements.

## Working with the user
The user is learning. They know JavaScript, some React and Supabase, and have never built a browser extension.
- Work one plan phase at a time, in small steps. Pause after each meaningful file or step.
- Teach **in the chat, not in files**. Before writing code, briefly explain the concepts involved. After writing, walk through what each file does and why.
- Explain extension concepts (manifest, service worker, content scripts, messaging, permissions, `chrome.*` APIs), TypeScript, WXT, spaced repetition and LLM integration in depth.
- Don't explain Supabase basics (tables, RLS, auth, migrations). Only explain extension-specific Supabase issues, like session storage in a service worker.
- Keep code comments normal and minimal. Don't write tutorial text, walkthroughs or explainer docs into the repo.

## Commands
Run from the repo root (pnpm workspace: `extension/`, `scripts/`).
- Install: `pnpm install`
- Dev (opens Chrome with hot reload): `pnpm dev`
- Build: `pnpm build`, then load `extension/.output/chrome-mv3` unpacked
- Type-check: `pnpm compile`
- Tests: added in Phase 4 (Vitest)
- Seed catalog (from `scripts/`): `pnpm seed` (= `fetch-lists` → `enrich` → `upload`)
- Run a migration (from `scripts/`): `pnpm migrate ../supabase/migrations/<file>.sql` (needs `psql` and `SUPABASE_DB_URL` in `scripts/.env`)
- Check `scripts/.env`: `pnpm check-env`

## Debugging
- Background logs: `chrome://extensions` → this extension → "Inspect views: service worker"
- Popup: right-click the popup → Inspect
- Content script logs: DevTools console on the leetcode.com tab
