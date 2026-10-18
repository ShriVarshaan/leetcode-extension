// Problems LeetCode renamed whose old slug no longer resolves.
const RENAMED: Record<string, string> = {
  'implement-strstr': 'find-the-index-of-the-first-occurrence-in-a-string',
};

// Turns any LeetCode problem link (or bare "two-sum/") into its current slug, e.g. "two-sum".
export function slugFromLink(link: string): string | null {
  const match =
    link.match(/leetcode\.com\/problems\/([a-z0-9-]+)/i) ?? link.match(/^([a-z0-9-]+)\/?$/i);
  if (!match) return null;
  const slug = match[1].toLowerCase();
  return RENAMED[slug] ?? slug;
}
