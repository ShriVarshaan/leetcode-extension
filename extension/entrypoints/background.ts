import { fetchRecentAccepted } from '@/lib/leetcode';
import type {
  BackgroundMessage,
  CollectSolvedResponse,
  ContentMessage,
  ImportHistoryResponse,
} from '@/lib/messages';
import { loadSettings, saveSettings } from '@/lib/settings';
import { recordSolves, syncStatus } from '@/lib/solves';
import { supabase } from '@/lib/supabase';

const SYNC_ALARM = 'sync-recent';
const SYNC_EVERY_MINUTES = 30;

export default defineBackground(() => {
  // Listeners must be registered synchronously: Chrome starts the service worker for an
  // event, runs this file top to bottom, then delivers the event to whoever is listening.
  browser.runtime.onInstalled.addListener(ensureSyncAlarm);
  browser.runtime.onStartup.addListener(ensureSyncAlarm);

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SYNC_ALARM) void syncRecent();
  });

  browser.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'import-history':
        importHistory().then(sendResponse);
        return true; // keeps the channel open for the async sendResponse
      case 'solve-detected':
        // LeetCode's public "recent accepted" list can lag a few seconds behind the UI.
        setTimeout(() => void syncRecent(), 3_000);
        setTimeout(() => void syncRecent(), 20_000);
        return false;
    }
  });
});

async function ensureSyncAlarm() {
  if (!(await browser.alarms.get(SYNC_ALARM))) {
    await browser.alarms.create(SYNC_ALARM, { delayInMinutes: 1, periodInMinutes: SYNC_EVERY_MINUTES });
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
      const { lc_username } = await loadSettings();
      if (!lc_username) return;
      await recordSolves(await fetchRecentAccepted(lc_username), 'sync');
      await syncStatus.setValue({ ...(await syncStatus.getValue()), lastSyncAt: new Date().toISOString(), lastError: null });
    } catch (e) {
      console.error('Sync failed', e);
      await syncStatus.setValue({ ...(await syncStatus.getValue()), lastError: (e as Error).message });
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
    if (!settings.lc_username) await saveSettings({ ...settings, lc_username: collected.username });

    const result = await recordSolves(collected.solved, 'import');
    const now = new Date().toISOString();
    await syncStatus.setValue({ lastImportAt: now, lastImport: result, lastSyncAt: now, lastError: null });
    return { ok: true, username: collected.username, result };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
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
