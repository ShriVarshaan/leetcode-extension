import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ImportHistoryRequest, ImportHistoryResponse } from '@/lib/messages';
import { Button, Card, Notice, Spinner } from '@/components/ui';
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
    <Card
      title="LeetCode sync"
      description="Imports every problem you've solved. You need to be logged in to leetcode.com in this browser. New solves are picked up automatically after that."
    >
      <div className="flex flex-wrap items-center gap-4">
        <Button variant={status?.lastImportAt ? 'secondary' : 'primary'} onClick={runImport} disabled={importing}>
          {importing ? <Spinner /> : <Download className="h-4 w-4" aria-hidden />}
          {importing ? 'Importing…' : status?.lastImportAt ? 'Re-import solved problems' : 'Import solved problems'}
        </Button>
        {status && (
          <dl className="flex gap-6 text-sm">
            <div>
              <dt className="text-xs text-muted">Last import</dt>
              <dd className="mt-0.5">{formatTime(status.lastImportAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Last sync</dt>
              <dd className="mt-0.5">{formatTime(status.lastSyncAt)}</dd>
            </div>
          </dl>
        )}
      </div>
      {message && (
        <div className="mt-4">
          <Notice kind={message.kind}>{message.text}</Notice>
        </div>
      )}
      {status?.lastError && (
        <div className="mt-4">
          <Notice kind="warn">Last sync failed: {status.lastError}</Notice>
        </div>
      )}
    </Card>
  );
}

function formatTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Never';
}

