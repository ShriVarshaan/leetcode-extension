import { useEffect, useState } from 'react';
import {
  Button,
  CheckIcon,
  ExternalIcon,
  FlameIcon,
  GearIcon,
  Logo,
  Notice,
  RefreshIcon,
  Spinner,
} from '@/components/ui';
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
    <div className="w-[23rem] p-4">
      <header className="flex items-center gap-2.5">
        <Logo className="h-7 w-7" />
        <div className="min-w-0 flex-1">
          <h1 className="text-sm leading-tight font-semibold">Revision Buddy</h1>
          <p className="text-xs text-muted">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
        </div>
        {streak !== null && streak > 0 && (
          <span
            title={`${streak} day${streak === 1 ? '' : 's'} in a row with at least one pick done`}
            className="flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent-strong"
          >
            <FlameIcon width={13} height={13} />
            {streak}
          </span>
        )}
        <button
          onClick={() => browser.runtime.openOptionsPage()}
          aria-label="Settings"
          title="Settings"
          className="rounded-lg p-2 text-muted transition hover:bg-raised hover:text-fg"
        >
          <GearIcon />
        </button>
      </header>

      {view.kind === 'loading' && <PicksSkeleton />}
      {view.kind === 'error' && (
        <div className="mt-4 space-y-3">
          <Notice kind="error">{view.message}</Notice>
          <Button variant="secondary" size="sm" onClick={() => location.reload()}>
            <RefreshIcon width={14} height={14} /> Try again
          </Button>
        </div>
      )}
      {view.kind === 'signed-out' && (
        <EmptyState
          title="Revise what you've already solved"
          text="Sign in and import your LeetCode history to get three revision problems a day."
          action="Sign in"
        />
      )}

      {view.kind === 'ready' && recs && (
        <>
          {recs.picks.length === 0 ? (
            <EmptyState
              title="Nothing to revise yet"
              text="Import your solved problems in Settings and your first picks will appear here."
              action="Open Settings"
            />
          ) : (
            <>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="font-medium text-muted">Today's picks</span>
                <span className="text-muted tabular-nums">
                  {done} of {recs.picks.length} done
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={recs.picks.length}
                aria-valuenow={done}
              >
                <div
                  className={`h-full rounded-full transition-all ${allDone ? 'bg-ok' : 'bg-accent'}`}
                  style={{ width: `${(done / recs.picks.length) * 100}%` }}
                />
              </div>
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
            </>
          )}
          {allDone && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-3 py-2.5 text-sm text-ok">
              <CheckIcon />
              All done for today. See you tomorrow!
            </div>
          )}
          {!allDone && recs.picks.length > 0 && (
            <div className="mt-2 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => run({ type: 'pick-again' })} disabled={busy}>
                {busy ? <Spinner className="h-3.5 w-3.5" /> : <RefreshIcon width={14} height={14} />}
                Pick again
              </Button>
            </div>
          )}
          <DuePreview topics={topics} />
        </>
      )}
      {actionError && view.kind === 'ready' && (
        <div className="mt-3 text-xs">
          <Notice kind="error">{actionError}</Notice>
        </div>
      )}
      {syncError && view.kind === 'ready' && (
        <p className="mt-3 text-xs text-warn">LeetCode sync problem: {friendlyError(new Error(syncError))}</p>
      )}
    </div>
  );
}

function EmptyState(props: { title: string; text: string; action: string }) {
  return (
    <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-line px-5 py-7 text-center">
      <Logo className="h-10 w-10" />
      <p className="mt-3 text-sm font-semibold">{props.title}</p>
      <p className="mt-1 text-xs text-muted">{props.text}</p>
      <Button size="sm" className="mt-4" onClick={() => browser.runtime.openOptionsPage()}>
        {props.action}
      </Button>
    </div>
  );
}

function PicksSkeleton() {
  return (
    <div className="mt-4 animate-pulse" aria-label="Loading today's picks">
      <div className="h-3 w-24 rounded bg-raised" />
      <div className="mt-2 h-1.5 rounded-full bg-raised" />
      <div className="mt-3 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-3">
            <div className="h-3.5 w-3/5 rounded bg-raised" />
            <div className="mt-2 flex gap-1.5">
              <div className="h-4 w-14 rounded-full bg-raised" />
              <div className="h-4 w-20 rounded-full bg-raised" />
            </div>
            <div className="mt-2 h-3 w-4/5 rounded bg-raised" />
          </div>
        ))}
      </div>
    </div>
  );
}

const DIFFICULTY_STYLES = {
  Easy: 'bg-easy/15 text-easy',
  Medium: 'bg-medium/15 text-medium',
  Hard: 'bg-hard/15 text-hard',
} as const;

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
      className={`rounded-xl border p-3 transition ${
        completed ? 'border-ok/30 bg-ok/5' : 'border-line bg-surface hover:border-subtle'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
            completed ? 'border-ok bg-ok text-page' : 'border-subtle'
          }`}
          aria-label={completed ? 'Done' : 'Not done yet'}
        >
          {completed && <CheckIcon width={12} height={12} strokeWidth={3} />}
        </span>
        <div className="min-w-0 flex-1">
          <a
            href={`https://leetcode.com/problems/${pick.slug}/`}
            target="_blank"
            rel="noreferrer"
            className={`group inline-flex max-w-full items-center gap-1 text-sm font-medium hover:text-accent-strong ${
              completed ? 'text-muted' : ''
            }`}
          >
            <span className="truncate">{pick.title}</span>
            <ExternalIcon width={12} height={12} className="shrink-0 opacity-0 transition group-hover:opacity-100" />
          </a>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
            <span className={`rounded-full px-2 py-0.5 ${DIFFICULTY_STYLES[pick.difficulty]}`}>{pick.difficulty}</span>
            <span className="rounded-full bg-raised px-2 py-0.5 text-muted">{pick.topic}</span>
          </div>
          <p className="mt-1.5 text-xs text-muted">{pick.reason}</p>
          {completed && !rating && (
            <div className="mt-2.5">
              <p className="text-xs font-medium">How did it go?</p>
              <div className="mt-1.5 grid grid-cols-4 gap-1">
                {([1, 2, 3, 4] as Rating[]).map((r) => (
                  <button
                    key={r}
                    disabled={props.busy}
                    onClick={() => props.onRate(r)}
                    className={`rounded-lg border border-line bg-surface py-1.5 text-xs font-medium transition disabled:opacity-50 ${RATING_STYLES[r]}`}
                  >
                    {RATING_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {completed && rating && (
            <p className="mt-1.5 text-xs font-medium text-ok">
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
    <div className="mt-4 space-y-2.5 border-t border-line pt-3 text-xs">
      <div>
        <p className="font-medium text-muted">Due now</p>
        {due.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {due.map((t) => (
              <span key={t.topic} className="rounded-full bg-hard/10 px-2 py-0.5 text-hard">
                {t.topic}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-subtle">Nothing. You're all caught up.</p>
        )}
      </div>
      {upcoming.length > 0 && (
        <div>
          <p className="font-medium text-muted">Coming up</p>
          <ul className="mt-1 space-y-0.5">
            {upcoming.map((t) => (
              <li key={t.topic} className="flex justify-between">
                <span>{t.topic}</span>
                <span className="text-subtle">{relativeDay(t.dueAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function relativeDay(iso: string) {
  const days = Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
  return days <= 1 ? 'tomorrow' : `in ${days} days`;
}

export default App;
