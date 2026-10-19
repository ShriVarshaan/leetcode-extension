import { useState } from 'react';
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
    <section className="mt-10 max-w-lg space-y-3">
      <h2 className="text-lg font-semibold">Your data</h2>
      <p className="text-sm text-slate-400">
        Stored in Supabase: your email, LeetCode username, settings, which catalog problems you solved and when, your
        review schedule and ratings, and your daily picks. Problem statements and your code are never stored.{' '}
        <a href={browser.runtime.getURL('/privacy.html')} target="_blank" rel="noreferrer" className="underline">
          Privacy policy
        </a>
      </p>
      {!confirming ? (
        <button onClick={() => setConfirming(true)} className="rounded border border-red-500/60 px-3 py-1.5 text-sm text-red-300">
          Delete my account and data
        </button>
      ) : (
        <div className="space-y-2 rounded border border-red-500/60 p-3 text-sm">
          <p>This permanently deletes your account and everything above. It can't be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={deleteAccount}
              disabled={deleting}
              className="rounded bg-red-600 px-3 py-1.5 font-medium text-white disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Yes, delete everything'}
            </button>
            <button onClick={() => setConfirming(false)} disabled={deleting} className="rounded px-3 py-1.5 text-slate-300">
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
