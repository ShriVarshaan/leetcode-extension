import { CircleUserRound } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { todayCache } from '@/lib/today-cache';
import type { SettingsChanged } from '@/lib/messages';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { Button, Logo, Notice, Spinner } from '@/components/ui';
import { DataSection } from './DataSection';
import { SignIn } from './SignIn';
import { SettingsForm } from './SettingsForm';
import { SyncSection } from './SyncSection';
import { TopicsSection } from './TopicsSection';

function App() {
  if (!isSupabaseConfigured) return <NotConfigured />;
  return <Configured />;
}

function NotConfigured() {
  return (
    <Shell>
      <Notice kind="warn">
        Supabase isn't configured yet. Copy <code>extension/.env.example</code> to <code>extension/.env</code>, fill in{' '}
        <code>WXT_SUPABASE_URL</code> and <code>WXT_SUPABASE_ANON_KEY</code>, then restart <code>pnpm dev</code>.
      </Notice>
    </Shell>
  );
}

function Shell(props: { account?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo className="h-12 w-12" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Revision Buddy</h1>
            <p className="mt-1 text-sm text-muted">Three LeetCode revision problems a day, on topics you've already solved.</p>
          </div>
          {props.account}
        </header>
        {props.children}
      </div>
    </div>
  );
}

function Configured() {
  // undefined = still checking storage for a saved session
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setSession(data.session);
      })
      .catch((e: Error) => {
        setError(e.message);
        setSession(null);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // The background schedules the daily alarm only while someone is signed in.
      // The popup shows the cached picks before checking the session, so don't leave them behind.
      if (event === 'SIGNED_OUT') void todayCache.removeValue();
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        void browser.runtime.sendMessage({ type: 'settings-changed' } satisfies SettingsChanged).catch(() => {});
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const account = session && (
    <div className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-1 pl-3 text-sm text-muted">
      <CircleUserRound className="h-4 w-4 shrink-0" aria-hidden />
      <span className="max-w-[16rem] truncate">{session.user.email}</span>
      <Button variant="ghost" size="sm" className="rounded-full" onClick={() => supabase.auth.signOut()}>
        Sign out
      </Button>
    </div>
  );

  return (
    <Shell account={account}>
      {error && (
        <div className="mb-6">
          <Notice kind="error">Couldn't restore your session: {error}</Notice>
        </div>
      )}
      {session === undefined ? (
        <div className="flex justify-center py-16 text-muted" aria-busy="true" aria-label="Loading">
          <Spinner className="h-6 w-6" />
        </div>
      ) : session ? (
        <div className="space-y-6">
          <SettingsForm />
          <SyncSection />
          <TopicsSection />
          <DataSection />
        </div>
      ) : (
        <SignIn />
      )}
    </Shell>
  );
}

export default App;
