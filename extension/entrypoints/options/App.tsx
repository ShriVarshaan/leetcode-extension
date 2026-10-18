import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { SignIn } from './SignIn';
import { SettingsForm } from './SettingsForm';
import { SyncSection } from './SyncSection';

function App() {
  if (!isSupabaseConfigured) return <NotConfigured />;
  return <Configured />;
}

function NotConfigured() {
  return (
    <div className="min-h-screen bg-slate-900 p-8 text-slate-100">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="mt-6 max-w-lg rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
        <p className="font-medium text-amber-300">Supabase isn't configured yet.</p>
        <p className="mt-2 text-slate-300">
          Copy <code>extension/.env.example</code> to <code>extension/.env</code>, fill in{' '}
          <code>WXT_SUPABASE_URL</code> and <code>WXT_SUPABASE_ANON_KEY</code>, then restart <code>pnpm dev</code>.
        </p>
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
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-slate-100">
      <header className="mb-8 flex max-w-lg items-center justify-between">
        <h1 className="text-2xl font-semibold">Settings</h1>
        {session && (
          <div className="text-right text-sm text-slate-400">
            {session.user.email}
            <button onClick={() => supabase.auth.signOut()} className="ml-3 text-slate-300 underline hover:text-white">
              Sign out
            </button>
          </div>
        )}
      </header>
      {error && <p className="mb-4 max-w-lg text-sm text-red-400">Couldn't restore your session: {error}</p>}
      {session === undefined ? <p className="text-slate-400">Loading…</p> : session ? (
        <>
          <SettingsForm />
          <SyncSection />
        </>
      ) : (
        <SignIn />
      )}
    </div>
  );
}

export default App;
