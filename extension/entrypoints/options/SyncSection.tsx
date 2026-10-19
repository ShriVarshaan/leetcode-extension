import { useEffect, useState } from 'react';
import type { ImportHistoryRequest, ImportHistoryResponse } from '@/lib/messages';
import { syncStatus, type SyncStatus } from '@/lib/solves';

export function SyncSection() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    syncStatus.getValue().then(setStatus);
    // Re-render when the background finishes a sync.
    return syncStatus.watch(setStatus);
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

    </section>
  );
}

function formatTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString() : 'Never';
}

