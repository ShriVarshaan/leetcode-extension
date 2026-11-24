import type { DailyRecs, SpoilerUnlocks } from './today-cache';

// Hiding hints, topic tags and discussion on a leetcode.com problem until it's accepted today.

export function isLocked(opts: {
  enabled: boolean;
  slug: string | null;
  today: string;
  unlocks: SpoilerUnlocks | null;
  recs: DailyRecs | null;
}): boolean {
  const { enabled, slug, today, unlocks, recs } = opts;
  if (!enabled || !slug) return false;
  if (unlocks?.date === today && unlocks.slugs.includes(slug)) return false;
  // A pick solved today counts even if the accepted result happened in another tab or browser.
  if (recs?.date === today && recs.completed.includes(slug)) return false;
  return true;
}

export function addUnlock(unlocks: SpoilerUnlocks | null, slug: string, today: string): SpoilerUnlocks {
  const slugs = unlocks?.date === today ? unlocks.slugs : [];
  return { date: today, slugs: slugs.includes(slug) ? slugs : [...slugs, slug] };
}

// LeetCode's class names are generated, so match on visible labels instead:
// the "Topics" and "Hint" pills under the title, and the collapsible
// "Topics", "Hint 1", "Discussion (2.2K)" sections below the description, plus the
// footer button that shows the discussion count ("2.2K") and jumps to it.
const PILL = /^(Topics|Hint)$/;
const SECTION = /^(Topics|Hint \d+|Discussion \(([^)]*)\))$/;
const MARK = 'data-rb-spoiler';
const LIST_MARK = 'data-rb-spoiler-list';

export const SPOILER_CSS = `
  [${MARK}], [${MARK}] + hr { display: none !important; }
  [${LIST_MARK}]::after {
    content: 'Topics, hints and discussion unlock after an Accepted submission. (Revision Buddy)';
    display: block; padding: 12px 0; font-size: 12px; opacity: .6;
  }`;

function ownText(el: Element): string {
  let text = '';
  for (const n of el.childNodes) if (n.nodeType === Node.TEXT_NODE) text += n.textContent;
  return text.trim();
}

// The sections are siblings separated by <hr>s, so a section is the ancestor whose parent has those.
function sectionOf(el: HTMLElement): HTMLElement | null {
  let node = el;
  for (let i = 0; i < 7; i++) {
    const parent = node.parentElement;
    if (!parent) return null;
    if (parent.querySelectorAll(':scope > hr').length >= 2) return node;
    node = parent;
  }
  return null;
}

export function markSpoilers(root: ParentNode): void {
  let discussionCount: string | null = null;
  for (const el of root.querySelectorAll<HTMLElement>('div, span')) {
    const text = ownText(el);
    if (!text || text.length > 30) continue;
    const label = SECTION.exec(text);
    if (label?.[2]) discussionCount = label[2];
    if (el.hasAttribute(MARK)) continue;
    if (label) {
      const section = sectionOf(el);
      if (section) {
        section.setAttribute(MARK, '');
        section.parentElement!.setAttribute(LIST_MARK, '');
        continue;
      }
    }
    if (PILL.test(text)) el.setAttribute(MARK, '');
  }
  if (discussionCount) {
    for (const button of root.querySelectorAll('button')) {
      if (button.textContent?.trim() === discussionCount) button.setAttribute(MARK, '');
    }
  }
}

export function unmarkSpoilers(root: ParentNode): void {
  for (const el of root.querySelectorAll(`[${MARK}]`)) el.removeAttribute(MARK);
  for (const el of root.querySelectorAll(`[${LIST_MARK}]`)) el.removeAttribute(LIST_MARK);
}
