import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pickTopic } from './topics.ts';
import type { ListEntry, Problem } from './types.ts';

interface LeetCodeQuestion {
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  difficulty: Problem['difficulty'];
  isPaidOnly: boolean;
  topicTags: { slug: string }[];
}

const dataFile = (name: string) => new URL(`../data/${name}`, import.meta.url);
const CACHE = dataFile('.cache/leetcode.json');

const entries = JSON.parse(await readFile(dataFile('lists.json'), 'utf8')) as ListEntry[];
const patterns = JSON.parse(await readFile(dataFile('neetcode-patterns.json'), 'utf8')) as Record<string, string>;

await mkdir(new URL('../data/.cache/', import.meta.url), { recursive: true });
const cache: Record<string, LeetCodeQuestion | null> = await readFile(CACHE, 'utf8')
  .then((s) => JSON.parse(s))
  .catch(() => ({}));

const slugs = [...new Set(entries.map((e) => e.slug))];
const missing = slugs.filter((s) => !(s in cache));
console.log(`${slugs.length} unique problems, ${missing.length} to fetch from LeetCode`);

for (const [i, slug] of missing.entries()) {
  cache[slug] = await fetchQuestion(slug);
  if ((i + 1) % 25 === 0 || i === missing.length - 1) {
    console.log(`  fetched ${i + 1}/${missing.length}`);
    await writeFile(CACHE, JSON.stringify(cache));
  }
  await new Promise((r) => setTimeout(r, 400)); // be polite to LeetCode
}

// Build one Problem per LeetCode problem ID. Different slugs that resolve to the
// same ID (e.g. an old URL that redirects) collapse into one row.
const problems = new Map<number, Problem>();
const slugAliases: Record<string, string> = {};
const notFound: string[] = [];

for (const slug of slugs) {
  const q = cache[slug];
  if (!q) {
    notFound.push(slug);
    continue;
  }
  const id = Number(q.questionFrontendId);
  if (q.titleSlug !== slug) slugAliases[slug] = q.titleSlug;
  if (problems.has(id)) continue;

  const tags = q.topicTags.map((t) => t.slug);
  const a2zEntry = entries.find((e) => e.list === 'striver_a2z' && e.slug === slug);
  problems.set(id, {
    slug: q.titleSlug,
    lc_id: id,
    title: q.title,
    difficulty: q.difficulty,
    topic: pickTopic(patterns[slug], a2zEntry, tags),
    tags,
    is_paid: q.isPaidOnly,
  });
}

const sorted = [...problems.values()].sort((a, b) => a.lc_id - b.lc_id);
await writeFile(dataFile('problems.json'), JSON.stringify(sorted, null, 2) + '\n');
await writeFile(dataFile('slug-aliases.json'), JSON.stringify(slugAliases, null, 2) + '\n');

const byTopic = Object.entries(Object.groupBy(sorted, (p) => p.topic)).map(([t, ps]) => `${t}: ${ps!.length}`);
console.log(`Wrote data/problems.json with ${sorted.length} problems (${sorted.filter((p) => p.is_paid).length} premium)`);
console.log(byTopic.join('\n'));
if (Object.keys(slugAliases).length) console.log('Renamed slugs:', slugAliases);
if (notFound.length) console.log('Not found on LeetCode (skipped):', notFound);

async function fetchQuestion(slug: string): Promise<LeetCodeQuestion | null> {
  const res = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({
      query: `query q($slug: String!) {
        question(titleSlug: $slug) {
          questionFrontendId title titleSlug difficulty isPaidOnly topicTags { slug }
        }
      }`,
      variables: { slug },
    }),
  });
  if (!res.ok) throw new Error(`LeetCode ${slug}: HTTP ${res.status}`);
  const json = (await res.json()) as { data?: { question: LeetCodeQuestion | null } };
  return json.data?.question ?? null;
}
