import { useState } from 'react';
import { Button, Card, Notice, Spinner } from '@/components/ui';
import { todayCache } from '@/lib/daily';
import { syncStatus } from '@/lib/solves';
import { supabase } from '@/lib/supabase';

export function DataSection() {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setDeleting(true);
    setError(null);
    try {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      await Promise.all([todayCache.removeValue(), syncStatus.removeValue()]);
      await browser.action.setBadgeText({ text: '' });
      // The session's user no longer exists, so only clear it locally.
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <Card
      title="Your data"
      description={
        <>
          Stored in Supabase: your email, LeetCode username, settings, which catalog problems you solved and when, your
          review schedule and ratings, and your daily picks. Problem statements and your code are never stored.{' '}
          <a
            href={browser.runtime.getURL('/privacy.html')}
            target="_blank"
            rel="noreferrer"
            className="text-accent-strong underline-offset-2 hover:underline"
          >
            Privacy policy
          </a>
        </>
      }
    >
      {!confirming ? (
        <Button variant="danger-outline" onClick={() => setConfirming(true)}>
          Delete my account and data
        </Button>
      ) : (
        <div className="space-y-3 rounded-xl border border-bad/40 bg-bad/5 p-4 text-sm">
          <p>This permanently deletes your account and everything above. It can't be undone.</p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={deleteAccount} disabled={deleting}>
              {deleting && <Spinner />}
              {deleting ? 'Deleting…' : 'Yes, delete everything'}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
    </Card>
  );
}
