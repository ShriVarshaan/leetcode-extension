import { updateBadge } from '@/lib/badge';
import { ensureToday, markCompleted, peekToday, pickAgain, ratePick, remaining, todayCache, todayFor, type DailyRecs } from '@/lib/daily';
import { friendlyError } from '@/lib/errors';
import { fetchRecentAccepted } from '@/lib/leetcode';
import type {
  BackgroundMessage,
  CollectSolvedResponse,
  ContentMessage,
  ImportHistoryResponse,
  TodayResponse,
} from '@/lib/messages';
import { recordAutoReviews } from '@/lib/reviews';
import { loadSettings, saveSettings } from '@/lib/settings';
import { recordSolves, syncStatus } from '@/lib/solves';
import { supabase } from '@/lib/supabase';
import { nextOccurrence } from '@/lib/time';

const SYNC_ALARM = 'sync-recent';
const SYNC_EVERY_MINUTES = 30;
const DAILY_ALARM = 'daily-picks';
const NOTIFICATION_ID = 'daily-picks';

export default defineBackground(() => {
  // Listeners must be registered synchronously: Chrome starts the service worker for an
  // event, runs this file top to bottom, then delivers the event to whoever is listening.
  browser.runtime.onInstalled.addListener(onStart);
  browser.runtime.onStartup.addListener(onStart);

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SYNC_ALARM) void syncRecent();
    if (alarm.name === DAILY_ALARM) void dailyPicks();
  });

  browser.notifications.onClicked.addListener((id) => {
    if (id !== NOTIFICATION_ID) return;
    void browser.notifications.clear(id);
    browser.action.openPopup().catch(() => browser.runtime.openOptionsPage());
  });

  // Keep the badge in step with today's picks, whichever part of the extension changed them.
  todayCache.watch((recs) => void refreshBadge(recs));

  browser.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'import-history':
        importHistory().then(sendResponse);
        return true; // keeps the channel open for the async sendResponse
      case 'settings-changed':
        void scheduleDaily();
        void peekToday().then((recs) => refreshBadge(recs)).catch(() => {});
        return false;
      case 'ensure-today':
        respondWithRecs(ensureToday(), sendResponse);
        return true;
      case 'pick-again':
        respondWithRecs(pickAgain(), sendResponse);
        return true;
      case 'rate-pick':
        respondWithRecs(ratePick(message.slug, message.rating), sendResponse);
        return true;
      case 'solve-detected':
        // LeetCode's public "recent accepted" list can lag a few seconds behind the UI.
        setTimeout(() => void syncRecent(), 3_000);
        setTimeout(() => void syncRecent(), 20_000);
        return false;
    }
  });
});

function respondWithRecs(work: Promise<DailyRecs>, sendResponse: (r: TodayResponse) => void) {
  work
    .then((recs): TodayResponse => ({ ok: true, recs }))
    .catch((e: unknown): TodayResponse => ({ ok: false, error: friendlyError(e) }))
    .then(sendResponse);
}

async function onStart() {
  if (!(await browser.alarms.get(SYNC_ALARM))) {
    await browser.alarms.create(SYNC_ALARM, { delayInMinutes: 1, periodInMinutes: SYNC_EVERY_MINUTES });
  }
  await scheduleDaily();
  if (await isSignedIn()) await refreshBadge(await peekToday().catch(() => null));
}

// A one-shot alarm at the next daily_time in the user's time zone, re-created each time it
// fires. A fixed 24h period would drift by an hour across daylight-saving changes.
async function scheduleDaily() {
  try {
    if (!(await isSignedIn())) return;
    const { daily_time, timezone } = await loadSettings();
    await browser.alarms.create(DAILY_ALARM, { when: nextOccurrence(new Date(), daily_time, timezone).getTime() });
  } catch (e) {
    console.error('Scheduling daily picks failed', e);
  }
}

async function dailyPicks() {
  try {
    if (!(await isSignedIn())) return;
    const settings = await loadSettings();
    const recs = await ensureToday(settings);
    const left = remaining(recs);
    if (settings.daily_notification && left > 0) {
      await browser.notifications.create(NOTIFICATION_ID, {
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon/128.png'),
        title: "Today's revision is ready",
        message: recs.picks.map((p) => `${p.title} (${p.topic})`).join('\n'),
      });
    }
  } catch (e) {
    console.error('Building daily picks failed', e);
  } finally {
    await scheduleDaily();
  }
}

async function refreshBadge(recs: DailyRecs | null) {
  try {
    const today = (await isSignedIn()) ? todayFor(await loadSettings()) : null;
    await updateBadge(recs, today);
  } catch (e) {
    console.error('Badge update failed', e);
  }
}

async function isSignedIn(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return data.session !== null;
}

let syncInFlight: Promise<void> | null = null;

// Pulls the user's 20 most recent accepted submissions (public API, no LeetCode login needed).
function syncRecent(): Promise<void> {
  syncInFlight ??= (async () => {
    try {
      if (!(await isSignedIn())) return;
      const settings = await loadSettings();
      if (!settings.lc_username) return;
      const { advanced } = await recordSolves(await fetchRecentAccepted(settings.lc_username), 'sync');
      // Solves of today's picks wait for a rating; any other solve is an automatic review.
      const others = await markCompleted(advanced, settings);
      await recordAutoReviews(others, settings.timezone);
      await refreshBadge(await todayCache.getValue());
      await syncStatus.setValue({ ...(await syncStatus.getValue()), lastSyncAt: new Date().toISOString(), lastError: null });
    } catch (e) {
      console.error('Sync failed', e);
      await syncStatus.setValue({ ...(await syncStatus.getValue()), lastError: friendlyError(e) });
    } finally {
      syncInFlight = null;
    }
  })();
  return syncInFlight;
}

// Imports every solved problem. The full list needs the user's LeetCode login, so the
// request is made by the content script inside a leetcode.com tab.
async function importHistory(): Promise<ImportHistoryResponse> {
  let openedTabId: number | null = null;
  try {
    if (!(await isSignedIn())) return { ok: false, error: 'Sign in to the extension first.' };

    const existing = await browser.tabs.query({ url: 'https://leetcode.com/*' });
    let tabId = existing[0]?.id;
    if (tabId === undefined) {
      const tab = await browser.tabs.create({ url: 'https://leetcode.com/problemset/', active: false });
      tabId = openedTabId = tab.id!;
    }
    await waitForContentScript(tabId);

    const collected = (await browser.tabs.sendMessage(tabId, {
      type: 'lc-collect-solved',
    } satisfies ContentMessage)) as CollectSolvedResponse;
    if (!collected.ok) return collected;

    const settings = await loadSettings();
    if (settings.lc_username && settings.lc_username.toLowerCase() !== collected.username.toLowerCase()) {
      return {
        ok: false,
        error: `You're logged in to LeetCode as "${collected.username}", but your settings say "${settings.lc_username}". Fix one of them and try again.`,
      };
    }
    if (!settings.lc_username) await saveSettings({ lc_username: collected.username });

    // Import never creates reviews: these are old solves, already reflected in the seeded schedules.
    const { advanced: _, ...result } = await recordSolves(collected.solved, 'import');
    const now = new Date().toISOString();
    await syncStatus.setValue({ lastImportAt: now, lastImport: result, lastSyncAt: now, lastError: null });
    return { ok: true, username: collected.username, result };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  } finally {
    if (openedTabId !== null) await browser.tabs.remove(openedTabId).catch(() => {});
  }
}

// A freshly opened tab needs a moment before its content script can answer.
async function waitForContentScript(tabId: number, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await browser.tabs.sendMessage(tabId, { type: 'lc-ping' } satisfies ContentMessage)) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Couldn\'t reach leetcode.com. Open leetcode.com in a tab and try again.');
}
