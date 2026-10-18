import { mkdir, writeFile } from 'node:fs/promises';
import { fetchNeetCode } from './sources/neetcode.ts';
import { fetchStriverA2Z } from './sources/striver-a2z.ts';
import type { ListEntry } from './types.ts';

const { entries: neetcode, patterns } = await fetchNeetCode();
const a2z = await fetchStriverA2Z();
const entries: ListEntry[] = [...neetcode, ...a2z];

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/lists.json', import.meta.url), JSON.stringify(entries, null, 2) + '\n');
await writeFile(
  new URL('../data/neetcode-patterns.json', import.meta.url),
  JSON.stringify(Object.fromEntries(patterns), null, 2) + '\n',
);

const count = (list: string) => entries.filter((e) => e.list === list).length;
const unique = new Set(entries.map((e) => e.slug)).size;
console.log(`Blind 75: ${count('blind75')}  NeetCode 150: ${count('neetcode150')}  Striver A2Z: ${count('striver_a2z')}`);
console.log(`Unique problems across all lists: ${unique}`);
console.log('Wrote data/lists.json');
