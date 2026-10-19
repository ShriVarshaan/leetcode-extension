import { Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, inputClass, Notice, Spinner } from '@/components/ui';
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
    <section className="mx-auto max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm">
      <h2 className="text-center text-lg font-semibold">{step === 'email' ? 'Sign in' : 'Check your email'}</h2>
      <p className="mt-1 text-center text-sm text-muted">
        {step === 'email' ? "We'll email you a one-time code. No password needed." : `We sent a code to ${email}.`}
      </p>
      {step === 'email' ? (
        <form onSubmit={sendCode} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </label>
          <Button disabled={busy} className="w-full">
            {busy && <Spinner />}
            {!busy && <Mail className="h-4 w-4" aria-hidden />}
            {busy ? 'Sending…' : 'Email me a code'}
          </Button>
          {googleEnabled && (
            <>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>
              <Button type="button" variant="secondary" disabled={busy} onClick={signInWithGoogle} className="w-full">
                Continue with Google
              </Button>
            </>
          )}
        </form>
      ) : (
        <form onSubmit={verifyCode} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            Code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${inputClass} text-center text-lg tracking-[0.4em]`}
            />
          </label>
          <Button disabled={busy} className="w-full">
            {busy && <Spinner />}
            {busy ? 'Checking…' : 'Sign in'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setStep('email')} className="w-full">
            Use a different email
          </Button>
        </form>
      )}
      {error && (
        <div className="mt-4">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
    </section>
  );
}
