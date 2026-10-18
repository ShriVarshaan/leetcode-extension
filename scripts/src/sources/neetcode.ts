import type { ListEntry } from '../types.ts';
import { slugFromLink } from '../slug.ts';

const URL = 'https://raw.githubusercontent.com/neetcode-gh/leetcode/main/.problemSiteData.json';

interface NeetCodeProblem {
  problem: string;
  pattern: string;
  link: string;
  blind75?: boolean;
  neetcode150?: boolean;
}

export async function fetchNeetCode(): Promise<{ entries: ListEntry[]; patterns: Map<string, string> }> {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`NeetCode data: HTTP ${res.status}`);
  const data = (await res.json()) as NeetCodeProblem[];

  const entries: ListEntry[] = [];
  // slug -> NeetCode pattern, used later as the preferred topic
  const patterns = new Map<string, string>();
  const positions = { blind75: 0, neetcode150: 0 };

  for (const p of data) {
    const slug = slugFromLink(p.link);
    if (!slug) continue;
    if (p.blind75 || p.neetcode150) patterns.set(slug, p.pattern);
    for (const list of ['blind75', 'neetcode150'] as const) {
      if (!p[list]) continue;
      entries.push({
        list,
        slug,
        title: p.problem,
        section: p.pattern,
        subsection: null,
        position: ++positions[list],
      });
    }
  }
  return { entries, patterns };
}
