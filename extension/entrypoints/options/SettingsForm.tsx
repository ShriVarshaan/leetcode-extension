import { useEffect, useState, type FormEvent } from 'react';
import {
  DEFAULT_MODELS,
  LISTS,
  llmSettings,
  loadSettings,
  saveSettings,
  type ListId,
  type LlmProvider,
  type LlmSettings,
  type UserSettings,
} from '@/lib/settings';

export function SettingsForm() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [llm, setLlm] = useState<LlmSettings | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadSettings(), llmSettings.getValue()])
      .then(([s, l]) => {
        setSettings(s);
        setLlm(l);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error && !settings) return <p className="text-red-400">{error}</p>;
  if (!settings || !llm) return <p className="text-slate-400">Loading…</p>;

  const update = (patch: Partial<UserSettings>) => setSettings({ ...settings, ...patch });
  const updateLlm = (patch: Partial<LlmSettings>) => setLlm({ ...llm, ...patch });

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
      await Promise.all([
        saveSettings({ ...settings!, lc_username: settings!.lc_username?.trim() || null }),
        llmSettings.setValue({ ...llm!, apiKey: llm!.apiKey.trim() }),
      ]);
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
        <label className="block text-sm text-slate-300">
          Daily reminder time
          <input
            type="time"
            value={settings.daily_time.slice(0, 5)}
            onChange={(e) => update({ daily_time: e.target.value })}
            className={input}
          />
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">AI picker (optional)</h2>
        <p className="text-sm text-slate-400">
          Your key is stored only in this browser and sent only to the provider. Without a key, a simple built-in picker is used.
        </p>
        <label className="block text-sm text-slate-300">
          Provider
          <select
            value={llm.provider}
            onChange={(e) => {
              const provider = e.target.value as LlmProvider;
              updateLlm({ provider, model: DEFAULT_MODELS[provider] });
            }}
            className={input}
          >
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI</option>
          </select>
        </label>
        <label className="block text-sm text-slate-300">
          Model
          <input value={llm.model} onChange={(e) => updateLlm({ model: e.target.value })} className={input} />
        </label>
        <label className="block text-sm text-slate-300">
          API key
          <input
            type="password"
            autoComplete="off"
            value={llm.apiKey}
            onChange={(e) => updateLlm({ apiKey: e.target.value })}
            className={input}
          />
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
