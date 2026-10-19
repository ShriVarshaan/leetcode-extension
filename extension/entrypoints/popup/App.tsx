import { useEffect, useState } from 'react';
import type { DailyPick } from '@/lib/candidates';
import { todayCache, type DailyRecs } from '@/lib/daily';
import { friendlyError } from '@/lib/errors';
import type { BackgroundMessage, TodayResponse } from '@/lib/messages';
import { loadStreak, loadTopicSummary, type TopicSummary } from '@/lib/progress';
import { loadSettings } from '@/lib/settings';
import { syncStatus } from '@/lib/solves';
import { RATING_LABELS, type Rating } from '@/lib/srs';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type View = { kind: 'loading' } | { kind: 'signed-out' } | { kind: 'error'; message: string } | { kind: 'ready' };

async function ask(message: BackgroundMessage): Promise<DailyRecs> {
  const res = (await browser.runtime.sendMessage(message)) as TodayResponse;
  if (!res.ok) throw new Error(res.error);
  return res.recs;
}

function App() {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [recs, setRecs] = useState<DailyRecs | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return setView({ kind: 'error', message: 'Supabase isn\'t configured.' });
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return setView({ kind: 'signed-out' });
      // Builds today's picks if the background hasn't yet (e.g. the browser was closed at daily_time).
      setRecs(await ask({ type: 'ensure-today' }));
      setView({ kind: 'ready' });
      const settings = await loadSettings();
      const [s, t] = await Promise.all([loadStreak(settings), loadTopicSummary(settings)]);
      setStreak(s);
      setTopics(t);
    })().catch((e: Error) => setView({ kind: 'error', message: friendlyError(e) }));
    void syncStatus.getValue().then((s) => setSyncError(s.lastError));
    // A solve detected while the popup is open ticks the pick straight away.
    return todayCache.watch((r) => r && setRecs(r));
  }, []);

  async function run(message: BackgroundMessage) {
    setBusy(true);
    setActionError(null);
    try {
      setRecs(await ask(message));
    } catch (e) {
      setActionError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const allDone = recs !== null && recs.picks.every((p) => recs.completed.includes(p.slug));

  return (
    <div className="w-[22rem] bg-slate-900 p-4 text-slate-100">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Revision Buddy</h1>
        <div className="flex items-center gap-2">
          {streak !== null && streak > 0 && (
            <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">{streak}-day streak</span>
          )}
          <button
            onClick={() => browser.runtime.openOptionsPage()}
            className="rounded px-2 py-1 text-sm text-slate-300 hover:bg-slate-700"
          >
            Settings
          </button>
        </div>
      </div>

      {view.kind === 'loading' && <p className="mt-4 text-sm text-slate-400">Loading today's picks…</p>}
      {view.kind === 'error' && <p className="mt-4 text-sm text-red-400">{view.message}</p>}
      {view.kind === 'signed-out' && (
        <p className="mt-4 text-sm text-slate-400">
          <button onClick={() => browser.runtime.openOptionsPage()} className="text-amber-400 underline">
            Sign in
          </button>{' '}
          and import your LeetCode history to get daily picks.
        </p>
      )}

      {view.kind === 'ready' && recs && (
        <>
          {recs.picks.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              Nothing to revise yet. Import your solved problems in Settings first.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recs.picks.map((p) => (
                <PickCard
                  key={p.slug}
                  pick={p}
                  completed={recs.completed.includes(p.slug)}
                  rating={recs.ratings[p.slug]}
                  busy={busy}
                  onRate={(rating) => run({ type: 'rate-pick', slug: p.slug, rating })}
                />
              ))}
            </ul>
          )}
          {actionError && <p className="mt-2 text-xs text-red-400">{actionError}</p>}
          {allDone && recs.picks.length > 0 && (
            <p className="mt-3 text-sm text-green-400">All done for today.</p>
          )}
          {!allDone && recs.picks.length > 0 && (
            <button
              onClick={() => run({ type: 'pick-again' })}
              disabled={busy}
              className="mt-3 text-xs text-slate-400 underline hover:text-slate-200 disabled:opacity-50"
            >
              Pick again
            </button>
          )}
          <DuePreview topics={topics} />
        </>
      )}
      {syncError && view.kind === 'ready' && (
        <p className="mt-3 text-xs text-amber-400/80">LeetCode sync problem: {friendlyError(new Error(syncError))}</p>
      )}
    </div>
  );
}

const DIFFICULTY_STYLES = {
  Easy: 'text-teal-300',
  Medium: 'text-amber-300',
  Hard: 'text-rose-400',
} as const;

function PickCard(props: {
  pick: DailyPick;
  completed: boolean;
  rating: Rating | 'auto' | undefined;
  busy: boolean;
  onRate: (r: Rating) => void;
}) {
  const { pick, completed, rating } = props;
  return (
    <li className={`rounded-lg border p-3 ${completed ? 'border-green-700/60 bg-green-900/10' : 'border-slate-700'}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 text-sm ${completed ? 'text-green-400' : 'text-slate-600'}`}>{completed ? '✓' : '○'}</span>
        <div className="min-w-0 flex-1">
          <a
            href={`https://leetcode.com/problems/${pick.slug}/`}
            target="_blank"
            rel="noreferrer"
            className="font-medium hover:text-amber-300 hover:underline"
          >
            {pick.title}
          </a>
          <div className="mt-0.5 text-xs">
            <span className={DIFFICULTY_STYLES[pick.difficulty]}>{pick.difficulty}</span>
            <span className="text-slate-500"> · {pick.reason}</span>
          </div>
        </div>
      </div>
      {completed && !rating && (
        <div className="mt-2 pl-6">
          <p className="text-xs text-slate-400">How did it go?</p>
          <div className="mt-1 flex gap-1">
            {([1, 2, 3, 4] as Rating[]).map((r) => (
              <button
                key={r}
                disabled={props.busy}
                onClick={() => props.onRate(r)}
                className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700 disabled:opacity-50"
              >
                {RATING_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      )}
      {completed && rating && (
        <p className="mt-1 pl-6 text-xs text-slate-500">
          {rating === 'auto' ? 'Counted as Good' : `Rated ${RATING_LABELS[rating]}`}
        </p>
      )}
    </li>
  );
}

function DuePreview({ topics }: { topics: TopicSummary[] }) {
  if (topics.length === 0) return null;
  const now = Date.now();
  const due = topics.filter((t) => Date.parse(t.dueAt) <= now);
  const upcoming = topics.filter((t) => Date.parse(t.dueAt) > now).slice(0, 4);
  return (
    <div className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-400">
      <p>
        <span className="text-slate-300">Due now:</span> {due.length ? due.map((t) => t.topic).join(', ') : 'nothing'}
      </p>
      {upcoming.length > 0 && (
        <p className="mt-1">
          <span className="text-slate-300">Coming up:</span>{' '}
          {upcoming.map((t) => `${t.topic} (${relativeDay(t.dueAt)})`).join(', ')}
        </p>
      )}
    </div>
  );
}

function relativeDay(iso: string) {
  const days = Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
  return days <= 1 ? 'tomorrow' : `in ${days} days`;
}

export default App;
