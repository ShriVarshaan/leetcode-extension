import { useEffect, useState } from 'react';
import type { ImportHistoryRequest, ImportHistoryResponse } from '@/lib/messages';
import { loadTopicSummary, type TopicSummary } from '@/lib/progress';
import { syncStatus, type SyncStatus } from '@/lib/solves';

export function SyncSection() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [topics, setTopics] = useState<TopicSummary[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const refreshTopics = () =>
    loadTopicSummary()
      .then(setTopics)
      .catch((e: Error) => setMessage({ kind: 'error', text: e.message }));

  useEffect(() => {
    syncStatus.getValue().then(setStatus);
    void refreshTopics();
    // Re-render when the background finishes a sync.
    return syncStatus.watch((s) => {
      setStatus(s);
      void refreshTopics();
    });
  }, []);

  async function runImport() {
    setImporting(true);
    setMessage(null);
    try {
      const res = (await browser.runtime.sendMessage({
        type: 'import-history',
      } satisfies ImportHistoryRequest)) as ImportHistoryResponse;
      if (res.ok) {
        const r = res.result;
        setMessage({
          kind: 'ok',
          text: `Found ${r.received} solved problems for ${res.username}. ${r.in_catalog} are in the lists (${r.new} new), ${r.new_topics} new topics scheduled.`,
        });
      } else {
        setMessage({ kind: 'error', text: res.error });
      }
      await refreshTopics();
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message });
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="mt-10 max-w-lg space-y-4">
      <h2 className="text-lg font-semibold">LeetCode sync</h2>
      <p className="text-sm text-slate-400">
        Imports every problem you've solved. You need to be logged in to leetcode.com in this browser. New solves are picked
        up automatically after that.
      </p>
      <button
        onClick={runImport}
        disabled={importing}
        className="rounded bg-amber-500 px-4 py-2 font-medium text-slate-900 disabled:opacity-50"
      >
        {importing ? 'Importing…' : status?.lastImportAt ? 'Re-import solved problems' : 'Import solved problems'}
      </button>
      {message && (
        <p className={`text-sm ${message.kind === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{message.text}</p>
      )}
      {status && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-slate-400">
          <dt>Last import</dt>
          <dd>{formatTime(status.lastImportAt)}</dd>
          <dt>Last sync</dt>
          <dd>{formatTime(status.lastSyncAt)}</dd>
          {status.lastError && (
            <>
              <dt>Last error</dt>
              <dd className="text-red-400">{status.lastError}</dd>
            </>
          )}
        </dl>
      )}

      {topics && topics.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="py-1 font-normal">Topic</th>
              <th className="py-1 font-normal">Solved</th>
              <th className="py-1 font-normal">Next review</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((t) => (
              <tr key={t.topic} className="border-t border-slate-800">
                <td className="py-1">{t.topic}</td>
                <td className="py-1">{t.solved}</td>
                <td className="py-1">{formatDue(t.dueAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function formatTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString() : 'Never';
}

function formatDue(iso: string) {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return 'Due now';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}
