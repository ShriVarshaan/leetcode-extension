import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { LISTS, type ListEntry, type Problem } from './types.ts';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in scripts/.env');

const supabase = createClient(url, key, { auth: { persistSession: false } });

const readData = async <T>(name: string) =>
  JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url), 'utf8')) as T;

const problems = await readData<Problem[]>('problems.json');
const entries = await readData<ListEntry[]>('lists.json');

// Entries whose slug didn't resolve on LeetCode have no problem row; skip them.
const known = new Set(problems.map((p) => p.slug));
const listProblems = entries
  .filter((e) => known.has(e.slug))
  .map((e) => ({
    list_id: e.list,
    slug: e.slug,
    position: e.position,
    section: e.section,
    subsection: e.subsection,
  }));

// Upsert = insert new rows, update existing ones (matched on the primary key),
// so this script is safe to re-run after the lists change.
await upsert('lists', Object.entries(LISTS).map(([id, name]) => ({ id, name })), 'id');
await upsert('problems', problems, 'slug');
await upsert('list_problems', listProblems, 'list_id,slug');

for (const id of Object.keys(LISTS)) {
  const { count, error } = await supabase
    .from('list_problems')
    .select('*', { count: 'exact', head: true })
    .eq('list_id', id);
  if (error) throw error;
  console.log(`${LISTS[id as keyof typeof LISTS]}: ${count} problems in Supabase`);
}

async function upsert(table: string, rows: object[], onConflict: string) {
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`Upserted ${rows.length} rows into ${table}`);
}
