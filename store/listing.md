# Store listing

Text and answers for the Chrome Web Store and Firefox Add-ons (AMO) forms. Images are in this folder.

## Packages

Build from the repo root with `pnpm zip` and `pnpm zip:firefox`. Output goes to `extension/.output/`:

- Chrome: `leetcode-revision-buddy-<version>-chrome.zip`
- Firefox: `leetcode-revision-buddy-<version>-firefox.zip`, plus `leetcode-revision-buddy-<version>-sources.zip` for AMO's source code upload (build steps in `SOURCE_CODE_REVIEW.md`)

## Shared

- **Name:** LeetCode Revision Buddy
- **Short description / summary:** Three LeetCode revision problems a day from topics you've already solved, scheduled with spaced repetition so each topic returns just before you'd forget it.
- **Homepage / support site:** https://github.com/ShriVarshaan/leetcode-extension
- **Support email:** optional, shown publicly on both stores (left blank)
- **Privacy policy:** https://shrivarshaan.github.io/leetcode-extension/privacy.html
- **Language:** English

### Description

```
Grinding through Blind 75 or NeetCode 150 once is the easy part. Remembering how sliding window works three months later is harder.

LeetCode Revision Buddy watches what you solve on leetcode.com, keeps a spaced-repetition schedule for each topic, and gives you three revision problems a day, just before you'd forget each topic.

FEATURES

• Three picks a day. New picks arrive at a time you choose and stay the same all day. "Pick again" swaps any you haven't finished.
• New problems, familiar topics. Picks favour problems you haven't solved yet in topics you have, so each review is fresh practice instead of a memory test.
• Spaced repetition per topic. Each topic (Trees, Two Pointers, 1-D DP and so on) has its own SM-2 schedule. Rate a finished pick Again, Hard, Good or Easy and the topic's next review moves to match.
• Solve detection. When LeetCode shows "Accepted", the extension syncs your recent submissions. Solves made outside your picks count as reviews too.
• History import. Pull in everything you've already solved, so the schedule starts from where you really are.
• Interview-weighted topics. Topics that come up more in interviews, like arrays, trees and graphs, get picked more often. You can override any topic's weight.
• Difficulty that adjusts. If a topic went well last time, the next problem is a step harder; if it went badly, a step easier. You can cap Hard problems per day.
• Curated lists. Problems come from Blind 75, NeetCode 150 and Striver's A2Z sheet, with or without premium problems.
• Reminders. A toolbar badge shows how many picks are left. Optional desktop notification for new picks and a weekly summary email on Sunday evening.
• On-page banner. Open one of today's picks and a small banner lets you rate it without leaving the page.

Each pick comes with a short reason, for example "Graphs · 4 days overdue · last solved 23 days ago".

HOW TO START

1. Install the extension and open its settings page.
2. Sign in with your email (a one-time code is sent to you).
3. Log in to leetcode.com in the same browser and import your solved problems.

PRIVACY

The extension stores your email, LeetCode username, settings, and which problems from the supported lists you've solved and when. Your code, your submissions and problem statements are never stored. There are no analytics or ads. You can delete your account and all its data from the settings page.

Not affiliated with LeetCode.
```

## Chrome Web Store

- **Category:** Education
- **Store icon:** `extension/public/icon/128.png`
- **Screenshots (1280×800):** `screenshot-1-picks.png`, `screenshot-2-topics.png`, `screenshot-3-settings.png`, `screenshot-4-sync.png`
- **Small promo tile (440×280):** `promo-small-440x280.png`
- **Marquee promo tile (1400×560):** `promo-marquee-1400x560.png`
- **Visibility:** Public, all regions

### Privacy practices

**Single purpose:**
Recommends three LeetCode revision problems a day from topics the user has already solved, using a spaced-repetition schedule built from their LeetCode solve history.

**storage:**
Stores the user's sign-in session, today's cached picks (for the toolbar badge and the on-page banner) and sync status locally, so the popup, settings page and background worker share them.

**alarms:**
Schedules the daily refresh that creates new picks at the user's chosen time, and the periodic sync of recent LeetCode solves.

**notifications:**
Shows an optional desktop notification when the day's picks are ready. Off by default and controlled in settings.

**Host permission (https://leetcode.com/*):**
Runs only on leetcode.com: detects an "Accepted" result to mark a pick as done, shows a small banner for today's picks on problem pages, and reads the user's solved-problem list from LeetCode (with their existing login) when they import their history.

**Remote code:** No, I am not using remote code. All JavaScript is bundled in the package.

**Data collected:**
- Personally identifiable information: email address (for sign-in and the optional weekly email)
- Website content: which LeetCode problems the user has solved and when, and their LeetCode username

**Certifications:** all three (no selling or transfer to third parties outside approved use cases; no use unrelated to the single purpose; no use for creditworthiness or lending).

### Test instructions

```
1. Open the extension's settings page (right-click the toolbar icon > Options).
2. Sign in with any email address you can read; a 6-digit code is emailed to you. Any address works and an account is created automatically.
3. Log in to leetcode.com in the same browser, then click "Import solved problems" in settings. Picks need at least a few solved problems from Blind 75 / NeetCode 150 to have topics to schedule.
4. Open the toolbar popup to see today's three picks.
No test account is needed. The extension only stores problem metadata, never problem statements or code.
```

## Firefox Add-ons (AMO)

- **Distribution:** On this site (listed)
- **Platforms:** Firefox desktop only (not Android)
- **Source code:** Yes, upload `leetcode-revision-buddy-<version>-sources.zip`
- **Categories:** Other
- **License:** All Rights Reserved
- **Tags:** productivity, education, coding
- **Screenshots:** the same four PNGs as Chrome

### Notes to reviewer

```
Build instructions are in SOURCE_CODE_REVIEW.md at the root of the source archive. In short: create extension/.env with the two values below, then run `pnpm install --frozen-lockfile` and `pnpm zip:firefox` from the archive root (Node 22.18+, pnpm 10+). The output in extension/.output/firefox-mv3 is byte-identical to the submitted package.

extension/.env:
WXT_SUPABASE_URL=<project URL>
WXT_SUPABASE_ANON_KEY=<anon key>
(These are the public Supabase URL and anon key, also visible in the bundle; row-level security protects the data.)

Testing: open the add-on's options page, sign in with any email address (a one-time code is emailed), log in to leetcode.com in the same browser and click "Import solved problems". The toolbar popup then shows three picks.

Data: the add-on sends the account email, LeetCode username, settings and solved-problem history (slug and date only) to its own Supabase backend, declared in data_collection_permissions. No remote code, analytics or trackers.
```
