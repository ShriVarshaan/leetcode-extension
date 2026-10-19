import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';

const googleEnabled = import.meta.env.WXT_GOOGLE_SIGN_IN === 'true';

export function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) setError(error.message);
      else setStep('code');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Opens Google's sign-in in a Chrome-managed window. Chrome catches the redirect to
  // https://<extension-id>.chromiumapp.org/ and hands the URL back instead of loading it.
  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: browser.identity.getRedirectURL(), skipBrowserRedirect: true },
      });
      if (error) throw error;
      const redirect = await browser.identity.launchWebAuthFlow({ url: data.url, interactive: true });
      const params = new URL(redirect!).searchParams;
      const code = params.get('code');
      if (!code) throw new Error(params.get('error_description') ?? 'Google sign-in was cancelled.');
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
      // On success, onAuthStateChange in App switches to the settings view.
      if (error) setError(error.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-sm rounded-lg border border-slate-700 p-6">
      <h2 className="text-lg font-semibold">Sign in</h2>
      {step === 'email' ? (
        <form onSubmit={sendCode} className="mt-4 space-y-3">
          <label className="block text-sm text-slate-300">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded bg-slate-800 px-3 py-2 text-slate-100"
            />
          </label>
          <button disabled={busy} className="w-full rounded bg-amber-500 py-2 font-medium text-slate-900 disabled:opacity-50">
            {busy ? 'Sending…' : 'Email me a code'}
          </button>
          {googleEnabled && (
            <button
              type="button"
              disabled={busy}
              onClick={signInWithGoogle}
              className="w-full rounded border border-slate-600 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
            >
              Continue with Google
            </button>
          )}
        </form>
      ) : (
        <form onSubmit={verifyCode} className="mt-4 space-y-3">
          <p className="text-sm text-slate-400">We sent a code to {email}.</p>
          <label className="block text-sm text-slate-300">
            Code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 w-full rounded bg-slate-800 px-3 py-2 tracking-widest text-slate-100"
            />
          </label>
          <button disabled={busy} className="w-full rounded bg-amber-500 py-2 font-medium text-slate-900 disabled:opacity-50">
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button type="button" onClick={() => setStep('email')} className="w-full text-sm text-slate-400 hover:text-slate-200">
            Use a different email
          </button>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
