import { createClient, type SupportedStorage } from '@supabase/supabase-js';

const url = import.meta.env.WXT_SUPABASE_URL;
const anonKey = import.meta.env.WXT_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error('Missing WXT_SUPABASE_URL / WXT_SUPABASE_ANON_KEY in extension/.env');
}

// supabase-js stores the session in localStorage by default, which doesn't exist in the
// background service worker and isn't shared between popup/options/background.
// chrome.storage.local is available in all of them, so the session is shared everywhere.
const chromeStorage: SupportedStorage = {
  async getItem(key) {
    const result = await browser.storage.local.get(key);
    return (result[key] as string | undefined) ?? null;
  },
  async setItem(key, value) {
    await browser.storage.local.set({ [key]: value });
  },
  async removeItem(key) {
    await browser.storage.local.remove(key);
  },
};

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: chromeStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
