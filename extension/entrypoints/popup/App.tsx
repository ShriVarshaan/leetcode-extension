import { useEffect, useState, type ReactNode } from 'react';
import { Check, CircleCheck, ExternalLink, Flame, Inbox, LogIn, RefreshCw, Settings, TriangleAlert } from 'lucide-react';
import { Button, IconButton, Logo, Notice } from '@/components/ui';
import type { DailyPick } from '@/lib/candidates';
import { todayCache, type DailyRecs } from '@/lib/daily';
import { friendlyError } from '@/lib/errors';
import type { BackgroundMessage, TodayResponse } from '@/lib/messages';
import { loadStreak, loadTopicSummary, type TopicSummary } from '@/lib/progress';
import { loadSettings } from '@/lib/settings';
import { syncStatus } from '@/lib/solves';
import { RATING_LABELS, type Rating } from '@/lib/srs';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { localDay } from '@/lib/time';

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
    // Show the cached picks straight away, then check with the background for changes.
    const today = localDay(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
    void todayCache.getValue().then((cached) => {
      if (cached?.date !== today) return;
      setRecs((r) => r ?? cached);
      setView((v) => (v.kind === 'loading' ? { kind: 'ready' } : v));
    });
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return setView({ kind: 'signed-out' });
      try {
        // Builds today's picks if the background hasn't yet (e.g. the browser was closed at daily_time).
        setRecs(await ask({ type: 'ensure-today' }));
        setView({ kind: 'ready' });
      } catch (e) {
        const message = friendlyError(e);
        // Keep showing cached picks if we have them.
        setView((v) => (v.kind === 'ready' ? v : { kind: 'error', message }));
        setActionError(message);
        return;
      }
      const settings = await loadSettings();
      const [s, t] = await Promise.all([loadStreak(settings), loadTopicSummary(settings)]);
      setStreak(s);
      setTopics(t);
    })().catch((e: Error) => setActionError(friendlyError(e)));
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

  const done = recs ? recs.picks.filter((p) => recs.completed.includes(p.slug)).length : 0;
  const allDone = recs !== null && recs.picks.length > 0 && done === recs.picks.length;

  return (
    <div className="w-[22.5rem] p-4">
      <header className="flex items-center gap-3">
        <Logo className="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <h1 className="text-sm leading-tight font-semibold">Revision Buddy</h1>
          <p className="text-xs text-muted">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
        </div>
        {streak !== null && streak > 0 && (
          <span
            title={`${streak} day${streak === 1 ? '' : 's'} in a row with at least one pick done`}
            className="flex h-8 items-center gap-1 rounded-full border border-warn/30 bg-warn/10 px-3 text-xs font-semibold text-warn tabular-nums"
          >
            <Flame className="h-3.5 w-3.5" aria-hidden />
            {streak}
            <span className="sr-only">day streak</span>
          </span>
        )}
        <IconButton label="Settings" onClick={() => browser.runtime.openOptionsPage()}>
          <Settings className="h-4 w-4" aria-hidden />
        </IconButton>
      </header>

      {view.kind === 'loading' && <PicksSkeleton />}
      {view.kind === 'error' && (
        <StateCard
          icon={<TriangleAlert className="h-5 w-5" aria-hidden />}
          tone="bad"
          title="Couldn't load today's picks"
          text={view.message}
        >
          <Button variant="secondary" size="sm" onClick={() => location.reload()}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
          </Button>
        </StateCard>
      )}
      {view.kind === 'signed-out' && (
        <StateCard
          icon={<Logo className="h-10 w-10" />}
          title="Revise what you've already solved"
          text="Sign in and import your LeetCode history to get three revision problems a day."
        >
          <Button size="sm" onClick={() => browser.runtime.openOptionsPage()}>
            <LogIn className="h-3.5 w-3.5" aria-hidden /> Sign in
          </Button>
        </StateCard>
      )}

      {view.kind === 'ready' && recs && (
        <>
          {recs.picks.length === 0 ? (
            <StateCard
              icon={<Inbox className="h-5 w-5" aria-hidden />}
              title="Nothing to revise yet"
              text="Import your solved problems in Settings and your first picks will appear here."
            >
              <Button size="sm" onClick={() => browser.runtime.openOptionsPage()}>
                <Settings className="h-3.5 w-3.5" aria-hidden /> Open Settings
              </Button>
            </StateCard>
          ) : (
            <>
              <div className="mt-4 flex items-baseline justify-between">
                <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Today's picks</h2>
                <span className="text-xs text-muted tabular-nums">
                  {done} of {recs.picks.length} done
                </span>
              </div>
              <div
                className="mt-2 flex gap-1"
                role="progressbar"
                aria-label="Today's progress"
                aria-valuemin={0}
                aria-valuemax={recs.picks.length}
                aria-valuenow={done}
              >
                {recs.picks.map((p, i) => (
                  <span
                    key={p.slug}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      i < done ? (allDone ? 'bg-ok' : 'bg-accent') : 'bg-line'
                    }`}
                  />
                ))}
              </div>
              <ul className="mt-4 space-y-2">
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
            </>
          )}
          {allDone && (
            <div role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
              <CircleCheck className="h-4 w-4 shrink-0" aria-hidden />
              All done for today. See you tomorrow!
            </div>
          )}
          {!allDone && recs.picks.length > 0 && (
            <div className="mt-2 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => run({ type: 'pick-again' })} disabled={busy}>
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden />
                Pick again
              </Button>
            </div>
          )}
          <DuePreview topics={topics} />
        </>
      )}
      {actionError && view.kind === 'ready' && (
        <div className="mt-4 text-xs">
          <Notice kind="error">{actionError}</Notice>
        </div>
      )}
      {syncError && view.kind === 'ready' && (
        <p className="mt-4 flex items-start gap-2 text-xs text-warn">
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          LeetCode sync problem: {friendlyError(new Error(syncError))}
        </p>
      )}
    </div>
  );
}

function StateCard(props: { icon: ReactNode; tone?: 'bad'; title: string; text: string; children: ReactNode }) {
  return (
    <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-8 text-center">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full ${
          props.tone === 'bad' ? 'bg-bad/10 text-bad' : 'bg-raised text-muted'
        }`}
      >
        {props.icon}
      </span>
      <p className="mt-4 text-sm font-semibold">{props.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{props.text}</p>
      <div className="mt-4">{props.children}</div>
    </div>
  );
}

function PicksSkeleton() {
  return (
    <div className="mt-4 animate-pulse" aria-busy="true" aria-label="Loading today's picks">
      <div className="flex justify-between">
        <div className="h-3 w-24 rounded bg-raised" />
        <div className="h-3 w-16 rounded bg-raised" />
      </div>
      <div className="mt-2 flex gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-1 flex-1 rounded-full bg-line" />
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3 rounded-xl border border-line bg-surface p-4">
            <div className="h-5 w-5 shrink-0 rounded-full bg-raised" />
            <div className="flex-1">
              <div className="h-3.5 w-3/5 rounded bg-raised" />
              <div className="mt-2 h-3 w-2/5 rounded bg-raised" />
              <div className="mt-2 h-3 w-4/5 rounded bg-raised" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const DIFFICULTY_DOT = { Easy: 'bg-easy', Medium: 'bg-medium', Hard: 'bg-hard' } as const;
const DIFFICULTY_TEXT = { Easy: 'text-easy', Medium: 'text-medium', Hard: 'text-hard' } as const;

const RATING_STYLES: Record<Rating, string> = {
  1: 'hover:border-bad/60 hover:bg-bad/10 hover:text-bad',
  2: 'hover:border-warn/60 hover:bg-warn/10 hover:text-warn',
  3: 'hover:border-ok/60 hover:bg-ok/10 hover:text-ok',
  4: 'hover:border-easy/60 hover:bg-easy/10 hover:text-easy',
};

function PickCard(props: {
  pick: DailyPick;
  completed: boolean;
  rating: Rating | 'auto' | undefined;
  busy: boolean;
  onRate: (r: Rating) => void;
}) {
  const { pick, completed, rating } = props;
  return (
    <li
      className={`rounded-xl border p-4 transition duration-200 ${
        completed ? 'border-ok/25 bg-ok/5' : 'border-line bg-surface hover:border-subtle hover:bg-raised/40'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
            completed ? 'border-ok bg-ok text-page' : 'border-subtle'
          }`}
          role="img"
          aria-label={completed ? 'Done' : 'Not done yet'}
        >
          {completed && <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <a
            href={`https://leetcode.com/problems/${pick.slug}/`}
            target="_blank"
            rel="noreferrer"
            className={`group inline-flex max-w-full items-start gap-1 rounded text-sm leading-snug font-medium transition-colors duration-200 hover:text-accent-strong ${
              completed ? 'text-muted' : ''
            }`}
          >
            <span className="line-clamp-2">{pick.title}</span>
            <ExternalLink
              className="mt-1 h-3 w-3 shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
              aria-hidden
            />
            <span className="sr-only">(opens LeetCode in a new tab)</span>
          </a>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span className={`flex items-center gap-1 font-medium ${DIFFICULTY_TEXT[pick.difficulty]}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${DIFFICULTY_DOT[pick.difficulty]}`} aria-hidden />
              {pick.difficulty}
            </span>
            <span aria-hidden>·</span>
            <span>{pick.topic}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">{pick.reason}</p>
          {completed && !rating && (
            <fieldset className="mt-3">
              <legend className="text-xs font-medium">How did it go?</legend>
              <div className="mt-2 grid grid-cols-4 gap-1">
                {([1, 2, 3, 4] as Rating[]).map((r) => (
                  <button
                    key={r}
                    disabled={props.busy}
                    onClick={() => props.onRate(r)}
                    className={`h-8 rounded-lg border border-line bg-surface text-xs font-medium transition duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-50 ${RATING_STYLES[r]}`}
                  >
                    {RATING_LABELS[r]}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {completed && rating && (
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-ok">
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
              {rating === 'auto' ? 'Done · counted as Good' : `Done · rated ${RATING_LABELS[rating]}`}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function DuePreview({ topics }: { topics: TopicSummary[] }) {
  if (topics.length === 0) return null;
  const now = Date.now();
  const due = topics.filter((t) => Date.parse(t.dueAt) <= now);
  const upcoming = topics.filter((t) => Date.parse(t.dueAt) > now).slice(0, 4);
  return (
    <div className="mt-4 space-y-4 border-t border-line pt-4 text-xs">
      <section>
        <h2 className="font-semibold tracking-wide text-muted uppercase">Due now</h2>
        {due.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {due.map((t) => (
              <span key={t.topic} className="rounded-full border border-hard/25 bg-hard/10 px-2 py-0.5 text-hard">
                {t.topic}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-muted">Nothing. You're all caught up.</p>
        )}
      </section>
      {upcoming.length > 0 && (
        <section>
          <h2 className="font-semibold tracking-wide text-muted uppercase">Coming up</h2>
          <ul className="mt-2 space-y-1">
            {upcoming.map((t) => (
              <li key={t.topic} className="flex justify-between gap-4">
                <span className="truncate">{t.topic}</span>
                <span className="shrink-0 text-muted">{relativeDay(t.dueAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function relativeDay(iso: string) {
  const days = Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
  return days <= 1 ? 'tomorrow' : `in ${days} days`;
}

export default App;
