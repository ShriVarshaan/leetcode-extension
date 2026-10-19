import { fetchAllSolved, fetchRecentAccepted, fetchSignedInUser, type SolvedProblem } from '@/lib/leetcode';
import type { CollectSolvedResponse, ContentMessage, RatePickRequest, SolveDetected, TodayResponse } from '@/lib/messages';
import { RATING_LABELS, type Rating } from '@/lib/srs';
import { localDay } from '@/lib/time';
import { todayCache, type DailyRecs } from '@/lib/today-cache';

export default defineContentScript({
  matches: ['https://leetcode.com/*'],
  main() {
    browser.runtime.onMessage.addListener((message: ContentMessage, _sender, sendResponse) => {
      switch (message.type) {
        case 'lc-ping':
          sendResponse(true);
          return false;
        case 'lc-collect-solved':
          collectSolved().then(sendResponse);
          return true; // async response
      }
    });
    watchForAccepted();
    showBanner();
  },
});

async function collectSolved(): Promise<CollectSolvedResponse> {
  try {
    const username = await fetchSignedInUser();
    if (!username) {
      return { ok: false, error: 'You\'re not logged in to leetcode.com in this browser. Log in there, then try again.' };
    }
    const solved = await fetchAllSolved();
    // Recent submissions have exact timestamps; prefer them where available.
    const recent = await fetchRecentAccepted(username).catch(() => [] as SolvedProblem[]);
    const bySlug = new Map(solved.map((s) => [s.slug, s.solvedAt]));
    for (const r of recent) {
      const known = bySlug.get(r.slug);
      if (!known || r.solvedAt > known) bySlug.set(r.slug, r.solvedAt);
    }
    return { ok: true, username, solved: [...bySlug].map(([slug, solvedAt]) => ({ slug, solvedAt })) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// LeetCode is a single-page app, so watch the DOM for the submission result instead of
// relying on page loads. This is only a trigger: the background then asks LeetCode's API
// what was actually accepted, so a false positive here does no harm.
function watchForAccepted() {
  let lastReported = { slug: '', at: 0 };
  let scheduled = false;

  const check = () => {
    scheduled = false;
    const slug = currentSlug();
    if (!slug) return;
    const result = document.querySelector('[data-e2e-locator="submission-result"]');
    if (result?.textContent?.trim() !== 'Accepted') return;
    if (lastReported.slug === slug && Date.now() - lastReported.at < 60_000) return;
    lastReported = { slug, at: Date.now() };
    void browser.runtime.sendMessage({ type: 'solve-detected', slug } satisfies SolveDetected);
  };

  new MutationObserver(() => {
    if (!scheduled) {
      scheduled = true;
      setTimeout(check, 500);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

const currentSlug = () => location.pathname.match(/^\/problems\/([^/]+)/)?.[1] ?? null;

// A small banner on problem pages that are one of today's picks. It lives in a shadow root
// so LeetCode's CSS can't restyle it (and ours can't leak into the page).
function showBanner() {
  const host = document.createElement('div');
  host.id = 'revision-buddy-banner';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    .box { position: fixed; left: 16px; bottom: 16px; z-index: 2147483647; max-width: 360px; padding: 10px 12px;
           border-radius: 8px; background: #0f172a; color: #e2e8f0; border: 1px solid #f59e0b80;
           font: 13px/1.4 system-ui, sans-serif; box-shadow: 0 4px 16px #0006; }
    .title { color: #fbbf24; font-weight: 600; }
    .row { margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
    button { font: inherit; padding: 2px 8px; border-radius: 4px; border: 0; background: #1e293b; color: #e2e8f0; cursor: pointer; }
    button:hover { background: #334155; }
    .close { position: absolute; top: 2px; right: 6px; background: none; color: #64748b; }
    .muted { color: #94a3b8; }
    .err { color: #f87171; margin-top: 4px; }`;
  let recs: DailyRecs | null = null;
  let shownFor = '';
  let dismissed = '';
  let error = '';

  const el = (tag: string, className: string, text = '') => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  };

  async function rate(slug: string, rating: Rating) {
    const res = (await browser.runtime.sendMessage({ type: 'rate-pick', slug, rating } satisfies RatePickRequest)) as TodayResponse;
    error = res.ok ? '' : res.error;
    if (res.ok) recs = res.recs;
    render();
  }

  const render = () => {
    const slug = currentSlug();
    const today = localDay(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
    const pick = recs?.date === today ? recs.picks.find((p) => p.slug === slug) : undefined;
    if (!pick || !recs || dismissed === pick.slug) {
      host.remove();
      return;
    }
    const completed = recs.completed.includes(pick.slug);
    const rating = recs.ratings[pick.slug];
    const key = `${pick.slug}|${completed}|${rating}|${error}`;
    if (key === shownFor && host.isConnected) return;
    shownFor = key;

    const box = el('div', 'box');
    box.setAttribute('role', 'status');
    const close = el('button', 'close', '×');
    close.setAttribute('aria-label', 'Hide');
    close.addEventListener('click', () => {
      dismissed = pick.slug;
      host.remove();
    });
    const line = el('div', '');
    line.append(el('span', 'title', 'Review'), ` ${pick.reason}`);
    box.append(close, line);

    if (completed && !rating) {
      const row = el('div', 'row');
      row.append(el('span', 'muted', 'How did it go?'));
      for (const r of [1, 2, 3, 4] as Rating[]) {
        const b = el('button', '', RATING_LABELS[r]);
        b.addEventListener('click', () => void rate(pick.slug, r));
        row.append(b);
      }
      box.append(row);
    } else if (completed) {
      box.append(el('div', 'row muted', `✓ Done${rating === 'auto' ? '' : ` · rated ${RATING_LABELS[rating as Rating]}`}`));
    }
    if (error) box.append(el('div', 'err', error));

    root.replaceChildren(style, box);
    if (!host.isConnected) document.body.append(host);
  };

  void todayCache.getValue().then((r) => {
    recs = r;
    render();
  });
  todayCache.watch((r) => {
    recs = r;
    render();
  });
  // LeetCode changes pages without reloading, so re-check when the URL changes.
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      render();
    }
  }, 1000);
}
