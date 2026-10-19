import { useEffect, useState, type FormEvent } from 'react';
import type { SettingsChanged } from '@/lib/messages';
import { LISTS, loadSettings, saveSettings, type ListId, type UserSettings } from '@/lib/settings';

export function SettingsForm() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error && !settings) return <p className="text-red-400">{error}</p>;
  if (!settings) return <p className="text-slate-400">Loading…</p>;

  const update = (patch: Partial<UserSettings>) => setSettings({ ...settings, ...patch });

  function toggleList(id: ListId) {
    const lists = settings!.lists.includes(id)
      ? settings!.lists.filter((l) => l !== id)
      : [...settings!.lists, id];
    update({ lists });
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    setError(null);
    if (settings!.lists.length === 0) return setError('Pick at least one list.');
    try {
      const { weight_overrides: _, ...rest } = settings!; // edited in the topic table
      await saveSettings({ ...rest, lc_username: rest.lc_username?.trim() || null });
      // The background reschedules the daily alarm for the new time.
      await browser.runtime.sendMessage({ type: 'settings-changed' } satisfies SettingsChanged);
      setStatus('Saved');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const input = 'mt-1 w-full rounded bg-slate-800 px-3 py-2 text-slate-100';

  return (
    <form onSubmit={onSave} className="max-w-lg space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">LeetCode</h2>
        <label className="block text-sm text-slate-300">
          LeetCode username
          <input
            value={settings.lc_username ?? ''}
            onChange={(e) => update({ lc_username: e.target.value })}
            placeholder="e.g. neal_wu"
            className={input}
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm text-slate-300">Problem lists</legend>
          {LISTS.map((list) => (
            <label key={list.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.lists.includes(list.id)} onChange={() => toggleList(list.id)} />
              {list.name}
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.include_paid}
            onChange={(e) => update({ include_paid: e.target.checked })}
          />
          Include premium-only problems
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Reminders</h2>
        <label className="block text-sm text-slate-300">
          New picks every day at
          <input
            type="time"
            value={settings.daily_time.slice(0, 5)}
            onChange={(e) => update({ daily_time: e.target.value })}
            className={input}
          />
          <span className="mt-1 block text-xs text-slate-500">Time zone: {settings.timezone}</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.daily_notification}
            onChange={(e) => update({ daily_notification: e.target.checked })}
          />
          Show a notification when today's picks are ready
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.weekly_email}
            onChange={(e) => update({ weekly_email: e.target.checked })}
          />
          Email me a weekly summary on Sunday evenings
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button className="rounded bg-amber-500 px-4 py-2 font-medium text-slate-900">Save</button>
        {status && <span className="text-sm text-green-400">{status}</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </form>
  );
}
