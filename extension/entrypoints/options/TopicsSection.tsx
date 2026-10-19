import { ArrowDown, ListChecks } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Card, Notice, Spinner } from '@/components/ui';
import { loadTopicSummary, type TopicSummary } from '@/lib/progress';
import { loadSettings, saveSettings } from '@/lib/settings';
import { syncStatus } from '@/lib/solves';
import { CardSkeleton } from './SettingsForm';

export function TopicsSection() {
  const [topics, setTopics] = useState<TopicSummary[] | null>(null);
  // Text of each weight input, keyed by topic. Empty means "use the default weight".
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [sort, setSort] = useState<SortKey>('due');
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      await saveSettings({ weight_overrides });
      await refresh();
      setStatus({ kind: 'ok', text: 'Saved. Applies from the next set of picks.' });
    } catch (e) {
      setStatus({ kind: 'error', text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  if (!topics) return status?.kind === 'error' ? <Notice kind="error">{status.text}</Notice> : <CardSkeleton />;

  const sorted = [...topics].sort(SORTS[sort]);
  const header = (key: SortKey, label: string, align = 'text-left') => (
    <th className={`px-3 py-2 font-medium ${align}`} aria-sort={sort === key ? 'ascending' : undefined}>
      <button
        type="button"
        onClick={() => setSort(key)}
        className={`-mx-1 inline-flex items-center gap-1 rounded px-1 transition duration-200 hover:text-fg ${sort === key ? 'text-fg' : ''}`}
      >
        {label}
        {sort === key && <ArrowDown className="h-3 w-3" aria-hidden />}
      </button>
    </th>
  );

  return (
    <Card
      title="Topics"
      description="Your review schedule per topic. A higher weight makes a due topic more likely to be picked; leave it empty to use the default."
    >
      {topics.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-raised text-muted">
            <ListChecks className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-4 text-sm font-medium">No topics yet</p>
          <p className="mt-1 text-sm text-muted">Import your solved problems above and your topics will show up here.</p>
        </div>
      ) : (
        <>
          <div className="-mx-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-line bg-raised/40 text-xs text-muted">
                <tr>
                  <th className="w-3 pl-6" />
                  {header('topic', 'Topic')}
                  {header('solved', 'Solved', 'text-right')}
                  {header('due', 'Next review')}
                  <th className="px-3 py-2 text-right font-medium">Interval</th>
                  {header('ease', 'Ease', 'text-right')}
                  <th className="py-2 pr-6 pl-3 text-right font-medium">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sorted.map((t) => {
                  const due = dueLabel(t.dueAt);
                  return (
                    <tr key={t.topic} className="transition duration-200 hover:bg-raised/60">
                      <td className="pl-6">
                        <span className={`block h-2 w-2 rounded-full ${DUE_DOT[due.tone]}`} />
                      </td>
                      <td className="px-3 py-3 font-medium">{t.topic}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{t.solved}</td>
                      <td className={`px-3 py-3 ${DUE_TEXT[due.tone]}`}>{due.text}</td>
                      <td className="px-3 py-3 text-right text-muted tabular-nums">
                        {t.intervalDays > 0 ? `${formatNumber(t.intervalDays)}d` : 'New'}
                      </td>
                      <td className={`px-3 py-3 text-right tabular-nums ${t.ease < 2 ? 'text-warn' : ''}`}>
                        {t.ease.toFixed(2)}
                      </td>
                      <td className="py-2 pr-6 pl-3 text-right">
                        <input
                          aria-label={`${t.topic} weight`}
                          inputMode="decimal"
                          value={overrides[t.topic] ?? ''}
                          placeholder={t.baseWeight.toFixed(2)}
                          onChange={(e) => setOverrides({ ...overrides, [t.topic]: e.target.value })}
                          className="h-8 w-16 rounded-md border border-line bg-page px-2 text-right text-sm tabular-nums transition duration-200 placeholder:text-muted hover:border-subtle focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-4 text-xs text-muted">
              <Legend tone="due">Due now</Legend>
              <Legend tone="soon">Within 2 days</Legend>
              <Legend tone="later">Later</Legend>
            </div>
            <div className="flex items-center gap-3">
              {status && (
                <span role="status" className={`text-sm ${status.kind === 'ok' ? 'text-ok' : 'text-bad'}`}>
                  {status.text}
                </span>
              )}
              <Button variant="secondary" onClick={saveWeights} disabled={saving}>
                {saving && <Spinner />}
                Save weights
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

type SortKey = 'due' | 'topic' | 'solved' | 'ease';
const SORTS: Record<SortKey, (a: TopicSummary, b: TopicSummary) => number> = {
  due: (a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt),
  topic: (a, b) => a.topic.localeCompare(b.topic),
  solved: (a, b) => b.solved - a.solved,
  ease: (a, b) => a.ease - b.ease,
};

type Tone = 'due' | 'soon' | 'later';
const DUE_DOT: Record<Tone, string> = { due: 'bg-hard', soon: 'bg-medium', later: 'bg-subtle' };
const DUE_TEXT: Record<Tone, string> = { due: 'text-hard font-medium', soon: 'text-medium', later: 'text-muted' };

function Legend({ tone, children }: { tone: Tone; children: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${DUE_DOT[tone]}`} />
      {children}
    </span>
  );
}

function dueLabel(iso: string): { text: string; tone: Tone } {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { text: 'Due now', tone: 'due' };
  const days = Math.ceil(ms / 86_400_000);
  if (days === 1) return { text: 'Tomorrow', tone: 'soon' };
  return { text: `In ${days} days`, tone: days <= 2 ? 'soon' : 'later' };
}

function formatNumber(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
