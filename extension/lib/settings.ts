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
  max_hard: number; // 0-3 Hard problems a day
  daily_time: string; // 'HH:MM' or 'HH:MM:SS' (Postgres time)
  timezone: string;
  weight_overrides: Record<string, number>;
  daily_notification: boolean;
  weekly_email: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  lc_username: null,
  lists: ['blind75', 'neetcode150', 'striver_a2z'],
  include_paid: false,
  max_hard: 3,
  daily_time: '09:00',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  weight_overrides: {},
  daily_notification: false,
  weekly_email: false,
};

export async function loadSettings(): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('lc_username, lists, include_paid, max_hard, daily_time, timezone, weight_overrides, daily_notification, weekly_email')
    .maybeSingle();
  if (error) throw error;
  return data ?? DEFAULT_SETTINGS;
}

// Saves only the given fields, so two forms editing different settings don't overwrite each other.
export async function saveSettings(patch: Partial<UserSettings>): Promise<void> {
  // RLS only allows the user's own row.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: user.id, ...patch, updated_at: new Date().toISOString() });
  if (error) throw error;
}
