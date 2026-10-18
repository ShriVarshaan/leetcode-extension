import { storage } from 'wxt/utils/storage';
import { supabase } from './supabase';

export type ListId = 'blind75' | 'neetcode150' | 'striver_a2z';

export const LISTS: { id: ListId; name: string }[] = [
  { id: 'blind75', name: 'Blind 75' },
  { id: 'neetcode150', name: 'NeetCode 150' },
  { id: 'striver_a2z', name: "Striver's A2Z (LeetCode only)" },
];

// Synced settings: stored in Supabase so they follow the user.
export interface UserSettings {
  lc_username: string | null;
  lists: ListId[];
  include_paid: boolean;
  daily_time: string; // 'HH:MM' or 'HH:MM:SS' (Postgres time)
  timezone: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  lc_username: null,
  lists: ['blind75', 'neetcode150', 'striver_a2z'],
  include_paid: false,
  daily_time: '09:00',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

export async function loadSettings(): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('lc_username, lists, include_paid, daily_time, timezone')
    .maybeSingle();
  if (error) throw error;
  return data ?? DEFAULT_SETTINGS;
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  // user_id defaults to auth.uid() in the database, and RLS only allows the user's own row.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: user.id, ...settings, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// Local-only settings: never leave this device. The API key lives here, not in Supabase.
export type LlmProvider = 'anthropic' | 'openai';

export interface LlmSettings {
  provider: LlmProvider;
  model: string;
  apiKey: string;
}

export const DEFAULT_MODELS: Record<LlmProvider, string> = {
  anthropic: 'claude-haiku-5-5',
  openai: 'gpt-4o-mini',
};

export const llmSettings = storage.defineItem<LlmSettings>('local:llmSettings', {
  fallback: { provider: 'anthropic', model: DEFAULT_MODELS.anthropic, apiKey: '' },
});
