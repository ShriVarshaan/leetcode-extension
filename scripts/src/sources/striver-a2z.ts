import type { ListEntry } from '../types.ts';
import { slugFromLink } from '../slug.ts';

const URL = 'https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2/';

// The page is a Next.js app. Its data is embedded in <script> tags as
// self.__next_f.push([1, "<escaped string>"]) chunks. Inside that data is a
// "sheet_syllabus" object shaped like:
//   { fields: [[...column names], ...], rows: [[fieldsIndex, ...values], ...], roots: [rowIndex, ...] }
// Each row's first value says which column-name list applies to it. Category rows
// have a "children" column holding indexes of their child rows.
interface Syllabus {
  fields: string[][];
  rows: unknown[][];
  roots: number[];
}

type Row = Record<string, unknown> & { label?: string; children?: number[]; leetcode_link?: string };

export async function fetchStriverA2Z(): Promise<ListEntry[]> {
  const res = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Striver A2Z page: HTTP ${res.status}`);
  const syllabus = extractSyllabus(await res.text());

  const row = (i: number): Row => {
    const [fieldsIndex, ...values] = syllabus.rows[i] as [number, ...unknown[]];
    return Object.fromEntries(syllabus.fields[fieldsIndex].map((name, j) => [name, values[j]]));
  };

  const entries: ListEntry[] = [];
  const seen = new Set<string>();
  let position = 0;

  for (const rootIndex of syllabus.roots) {
    const step = row(rootIndex);
    const section = (step.label ?? '').trim();
    for (const childIndex of step.children ?? []) {
      const subsection = (row(childIndex).label ?? '').trim();
      const walk = (i: number) => {
        const r = row(i);
        const slug = r.leetcode_link ? slugFromLink(r.leetcode_link) : null;
        // Keep only LeetCode problems, and only their first appearance in the sheet.
        if (slug && !seen.has(slug)) {
          seen.add(slug);
          entries.push({
            list: 'striver_a2z',
            slug,
            title: String(r.label ?? slug).trim(),
            section,
            subsection,
            position: ++position,
          });
        }
        for (const c of r.children ?? []) walk(c);
      };
      walk(childIndex);
    }
  }
  return entries;
}

function extractSyllabus(html: string): Syllabus {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map(
    (m) => JSON.parse(`"${m[1]}"`) as string,
  );
  const data = chunks.join('');
  const key = data.indexOf('"sheet_syllabus"');
  if (key === -1) throw new Error('Striver A2Z: sheet_syllabus not found (page format changed?)');

  // Find the end of the JSON object that starts after the key by matching brackets.
  const start = data.indexOf('{', key);
  let depth = 0;
  let inString = false;
  for (let i = start; i < data.length; i++) {
    const c = data[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return JSON.parse(data.slice(start, i + 1)) as Syllabus;
    }
  }
  throw new Error('Striver A2Z: could not parse sheet_syllabus');
}
