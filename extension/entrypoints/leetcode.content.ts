import { fetchAllSolved, fetchRecentAccepted, fetchSignedInUser, type SolvedProblem } from '@/lib/leetcode';
import type { CollectSolvedResponse, ContentMessage, SolveDetected } from '@/lib/messages';

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
    const slug = location.pathname.match(/^\/problems\/([^/]+)/)?.[1];
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
