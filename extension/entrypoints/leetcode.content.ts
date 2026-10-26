import { fetchAllSolved, fetchRecentAccepted, fetchSignedInUser, type SolvedProblem } from '@/lib/leetcode';
import type { CollectSolvedResponse, ContentMessage, RatePickRequest, SolveDetected, TodayResponse } from '@/lib/messages';
import { RATING_LABELS, type Rating } from '@/lib/srs';
import { browserTimeZone, localDay } from '@/lib/time';
import { timeZoneCache, todayCache, type DailyRecs } from '@/lib/today-cache';

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
    :host { --bg: #1e1e1e; --fg: #eff1f6; --muted: #a3a8b3; --line: #3a3a3a; --raised: #2a2a2a; --accent: #ffa116; --accent-text: #ffa116;
            --ok: #2cbb5d; --bad: #ef4743; --warn: #ffb800; --easy: #00b8a3; --shadow: 0 8px 24px #0008; }
    :host([data-theme='light']) { --bg: #ffffff; --fg: #1a1a1a; --muted: #5c6370; --line: #e6e6e6; --raised: #f3f4f5;
            --accent-text: #b45309; --ok: #1a7f3c; --bad: #c62f2b; --warn: #a15c00; --easy: #00796b; --shadow: 0 8px 24px #0002; }
    .box { position: fixed; left: 20px; bottom: 56px; z-index: 2147483647; width: 320px; box-sizing: border-box;
           padding: 16px; border-radius: 12px; background: var(--bg); color: var(--fg);
           border: 1px solid var(--line); border-left: 3px solid var(--accent); box-shadow: var(--shadow);
           font: 13px/1.45 -apple-system, system-ui, 'Segoe UI', sans-serif; animation: in .2s ease-out; }
    @keyframes in { from { opacity: 0; transform: translateY(8px); } }
    @media (prefers-reduced-motion: reduce) { .box { animation: none; } button { transition: none; } }
    .head { display: flex; align-items: center; gap: 8px; padding-right: 24px; }
    .label { color: var(--accent-text); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
    .chip { padding: 1px 8px; border-radius: 999px; background: var(--raised); color: var(--muted); font-size: 12px; }
    .reason { margin-top: 8px; color: var(--muted); }
    .ask { margin-top: 12px; font-weight: 600; font-size: 12px; }
    .row { margin-top: 8px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
    button { font: inherit; font-size: 12px; font-weight: 500; height: 32px; padding: 0; border-radius: 8px; cursor: pointer;
             border: 1px solid var(--line); background: var(--raised); color: var(--fg); transition: .2s; }
    button:active { transform: scale(.96); }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .r1:hover { border-color: var(--bad); color: var(--bad); }
    .r2:hover { border-color: var(--warn); color: var(--warn); }
    .r3:hover { border-color: var(--ok); color: var(--ok); }
    .r4:hover { border-color: var(--easy); color: var(--easy); }
    .close { position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; display: grid; place-items: center;
             border: 0; background: none; color: var(--muted); }
    .close:hover { background: var(--raised); color: var(--fg); }
    .done { margin-top: 8px; color: var(--ok); font-weight: 500; }
    .err { margin-top: 8px; color: var(--bad); }`;
  // Follow LeetCode's own light/dark theme (it toggles a "dark" class on <html>).
  const syncTheme = () => host.setAttribute('data-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  syncTheme();
  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  let recs: DailyRecs | null = null;
  let timeZone = browserTimeZone();
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
    const today = localDay(new Date(), timeZone);
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
    const close = el('button', 'close');
    // Lucide's "x" icon, inlined since this banner isn't React.
    close.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    close.setAttribute('aria-label', 'Hide');
    close.title = 'Hide';
    close.addEventListener('click', () => {
      dismissed = pick.slug;
      host.remove();
    });
    const head = el('div', 'head');
    head.append(el('span', 'label', "Today's revision"), el('span', 'chip', pick.topic));
    box.append(close, head, el('div', 'reason', pick.reason));

    if (completed && !rating) {
      const row = el('div', 'row');
      for (const r of [1, 2, 3, 4] as Rating[]) {
        const b = el('button', `r${r}`, RATING_LABELS[r]);
        b.addEventListener('click', () => void rate(pick.slug, r));
        row.append(b);
      }
      box.append(el('div', 'ask', 'Nice! How did it go?'), row);
    } else if (completed) {
      box.append(el('div', 'done', `✓ Done${rating === 'auto' ? '' : ` · rated ${RATING_LABELS[rating as Rating]}`}`));
    }
    if (error) box.append(el('div', 'err', error));

    root.replaceChildren(style, box);
    if (!host.isConnected) document.body.append(host);
  };

  void Promise.all([todayCache.getValue(), timeZoneCache.getValue()]).then(([r, tz]) => {
    recs = r;
    timeZone = tz ?? timeZone;
    render();
  });
  timeZoneCache.watch((tz) => {
    timeZone = tz ?? browserTimeZone();
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
