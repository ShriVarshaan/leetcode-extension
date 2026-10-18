import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { SignIn } from './SignIn';
import { SettingsForm } from './SettingsForm';

function App() {
  // undefined = still checking storage for a saved session
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
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
      {session === undefined ? null : session ? <SettingsForm /> : <SignIn />}
    </div>
  );
}

export default App;
