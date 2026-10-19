import { useEffect, useState } from 'react';
import { loadTopicSummary, type TopicSummary } from '@/lib/progress';
import { loadSettings, saveSettings } from '@/lib/settings';
import { syncStatus } from '@/lib/solves';

export function TopicsSection() {
  const [topics, setTopics] = useState<TopicSummary[] | null>(null);
  // Text of each weight input, keyed by topic. Empty means "use the default weight".
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const refresh = async () => {
    try {
      const settings = await loadSettings();
      setTopics(await loadTopicSummary(settings));
      setOverrides(Object.fromEntries(Object.entries(settings.weight_overrides).map(([t, w]) => [t, String(w)])));
    } catch (e) {
      setStatus({ kind: 'error', text: (e as Error).message });
    }
  };

  useEffect(() => {
    void refresh();
    return syncStatus.watch(() => void refresh());
  }, []);

  async function saveWeights() {
    setStatus(null);
    const weight_overrides: Record<string, number> = {};
    for (const [topic, text] of Object.entries(overrides)) {
      if (text.trim() === '') continue;
      const w = Number(text);
      if (!Number.isFinite(w) || w < 0.1 || w > 5) {
        return setStatus({ kind: 'error', text: `${topic}: weight must be between 0.1 and 5.` });
      }
      weight_overrides[topic] = w;
    }
    try {
      await saveSettings({ weight_overrides });
      await refresh();
      setStatus({ kind: 'ok', text: 'Weights saved. They apply from the next set of picks.' });
    } catch (e) {
      setStatus({ kind: 'error', text: (e as Error).message });
    }
  }

  if (!topics || topics.length === 0) return null;

  return (
    <section className="mt-10 max-w-2xl space-y-3">
      <h2 className="text-lg font-semibold">Topics</h2>
      <p className="text-sm text-slate-400">
        A higher weight makes a due topic more likely to be picked. Leave a weight empty to use the default.
      </p>
      <table className="w-full text-left text-sm">
        <thead className="text-slate-400">
          <tr>
            <th className="py-1 font-normal">Topic</th>
            <th className="py-1 font-normal">Solved</th>
            <th className="py-1 font-normal">Next review</th>
            <th className="py-1 font-normal">Interval</th>
            <th className="py-1 font-normal">Ease</th>
            <th className="py-1 font-normal">Weight</th>
          </tr>
        </thead>
        <tbody>
          {topics.map((t) => (
            <tr key={t.topic} className="border-t border-slate-800">
              <td className="py-1">{t.topic}</td>
              <td className="py-1">{t.solved}</td>
              <td className="py-1">{formatDue(t.dueAt)}</td>
              <td className="py-1">{t.intervalDays > 0 ? `${formatNumber(t.intervalDays)}d` : 'New'}</td>
              <td className="py-1">{t.ease.toFixed(2)}</td>
              <td className="py-1">
                <input
                  aria-label={`${t.topic} weight`}
                  inputMode="decimal"
                  value={overrides[t.topic] ?? ''}
                  placeholder={t.baseWeight.toFixed(2)}
                  onChange={(e) => setOverrides({ ...overrides, [t.topic]: e.target.value })}
                  className="w-16 rounded bg-slate-800 px-2 py-0.5 text-slate-100 placeholder:text-slate-500"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3">
        <button onClick={saveWeights} className="rounded bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600">
          Save weights
        </button>
        {status && (
          <span className={`text-sm ${status.kind === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{status.text}</span>
        )}
      </div>
    </section>
  );
}

function formatDue(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Due now';
  const days = Math.ceil(ms / 86_400_000);
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function formatNumber(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
