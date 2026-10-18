import { createClient, type SupportedStorage } from '@supabase/supabase-js';

const url: string | undefined = import.meta.env.WXT_SUPABASE_URL;
const anonKey: string | undefined = import.meta.env.WXT_SUPABASE_ANON_KEY;

// Lets the UI show a setup message instead of crashing when extension/.env is missing.
export const isSupabaseConfigured = Boolean(url && anonKey);

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

// Placeholder values keep createClient from throwing; no requests are made while unconfigured.
export const supabase = createClient(url || 'https://not-configured.supabase.co', anonKey || 'not-configured', {
  auth: {
    storage: chromeStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
