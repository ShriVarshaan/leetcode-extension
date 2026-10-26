import { Save } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { SettingsChanged } from '@/lib/messages';
import { Button, Card, inputClass, Notice, Spinner, Toggle } from '@/components/ui';
import { LISTS, loadSettings, saveSettings, type ListId, type UserSettings } from '@/lib/settings';
import { browserTimeZone, isValidTimeZone } from '@/lib/time';

const LIST_HINTS: Record<ListId, string> = {
  blind75: 'The classic 75',
  neetcode150: 'Blind 75 plus 75 more',
  striver_a2z: 'The LeetCode problems in the A2Z sheet',
};

const TIME_ZONES = Intl.supportedValuesOf('timeZone');
const BROWSER_TIME_ZONE = browserTimeZone();

export function SettingsForm() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error && !settings) return <Notice kind="error">{error}</Notice>;
  if (!settings) return <CardSkeleton />;

  const update = (patch: Partial<UserSettings>) => {
    setSettings({ ...settings, ...patch });
    setDirty(true);
    setStatus(null);
  };

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
    const timezone = settings!.timezone.trim();
    if (!isValidTimeZone(timezone)) return setError('Pick a time zone from the list, e.g. Europe/London.');
    setSaving(true);
    try {
      const { weight_overrides: _, ...rest } = settings!; // edited in the topic table
      await saveSettings({ ...rest, timezone, lc_username: rest.lc_username?.trim() || null });
      // The background reschedules the daily alarm for the new time.
      await browser.runtime.sendMessage({ type: 'settings-changed' } satisfies SettingsChanged);
      setDirty(false);
      setStatus('Saved');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-6">
      <Card title="LeetCode" description="Which problems your picks come from.">
        <label className="block text-sm font-medium">
          LeetCode username
          <input
            value={settings.lc_username ?? ''}
            onChange={(e) => update({ lc_username: e.target.value })}
            placeholder="e.g. neal_wu"
            className={inputClass}
          />
        </label>
        <fieldset className="mt-6">
          <legend className="text-sm font-medium">Problem lists</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {LISTS.map((list) => {
              const on = settings.lists.includes(list.id);
              return (
                <label
                  key={list.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition duration-200 ${
                    on ? 'border-accent/60 bg-accent/10' : 'border-line hover:border-subtle hover:bg-raised/60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleList(list.id)}
                    className="mt-0.5 h-4 w-4 accent-accent"
                  />
                  <span>
                    <span className="block text-sm font-medium">{list.name}</span>
                    <span className="block text-xs text-muted">{LIST_HINTS[list.id]}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <label className="mt-6 block text-sm font-medium">
          Most Hard problems a day
          <select
            value={settings.max_hard}
            onChange={(e) => update({ max_hard: Number(e.target.value) })}
            className={`${inputClass} max-w-[10rem]`}
          >
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>{n === 3 ? '3 (no limit)' : n}</option>
            ))}
          </select>
          <span className="mt-2 block text-xs font-normal text-muted">Over the limit, you get a Medium or Easy problem on that topic instead.</span>
        </label>
        <div className="mt-4 border-t border-line pt-2">
          <Toggle
            checked={settings.include_paid}
            onChange={(include_paid) => update({ include_paid })}
            label="Include premium-only problems"
            hint="Only turn this on if you have LeetCode Premium."
          />
        </div>
      </Card>

      <Card title="Reminders" description="When new picks arrive and how you hear about them.">
        <label className="block text-sm font-medium">
          New picks every day at
          <input
            type="time"
            value={settings.daily_time.slice(0, 5)}
            onChange={(e) => update({ daily_time: e.target.value })}
            className={`${inputClass} max-w-[10rem]`}
          />
        </label>
        <label className="mt-6 block text-sm font-medium">
          Time zone
          <input
            list="time-zones"
            value={settings.timezone}
            onChange={(e) => update({ timezone: e.target.value })}
            placeholder="e.g. Europe/London"
            spellCheck={false}
            className={`${inputClass} max-w-[20rem]`}
          />
          <datalist id="time-zones">
            {TIME_ZONES.map((z) => <option key={z} value={z} />)}
          </datalist>
          <span className="mt-2 block text-xs font-normal text-muted">Your day, streak and weekly email follow this time zone.</span>
        </label>
        {settings.timezone !== BROWSER_TIME_ZONE && (
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => update({ timezone: BROWSER_TIME_ZONE })}>
            Use this browser's time zone ({BROWSER_TIME_ZONE})
          </Button>
        )}
        <div className="mt-4 divide-y divide-line border-t border-line">
          <Toggle
            checked={settings.daily_notification}
            onChange={(daily_notification) => update({ daily_notification })}
            label="Daily notification"
            hint="Let me know when today's picks are ready."
          />
          <Toggle
            checked={settings.weekly_email}
            onChange={(weekly_email) => update({ weekly_email })}
            label="Weekly summary email"
            hint="Sent on Sunday evenings: solves, reviews, streak and what's due next."
          />
        </div>
      </Card>

      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-6 py-4 shadow-lg">
        <span className={`text-sm ${error ? 'text-bad' : status ? 'text-ok' : 'text-muted'}`} role="status">
          {error ?? status ?? (dirty ? 'You have unsaved changes.' : 'All changes saved.')}
        </span>
        <Button variant={dirty ? 'primary' : 'secondary'} disabled={!dirty || saving}>{saving ? <Spinner /> : <Save className="h-4 w-4" aria-hidden />}
          Save changes</Button>
      </div>
    </form>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-line bg-surface p-6">
      <div className="h-4 w-32 rounded bg-raised" />
      <div className="mt-2 h-3 w-56 rounded bg-raised" />
      <div className="mt-6 h-10 rounded-lg bg-raised" />
      <div className="mt-3 h-10 rounded-lg bg-raised" />
    </div>
  );
}
