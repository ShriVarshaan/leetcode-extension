import { storage } from 'wxt/utils/storage';
import type { SolvedProblem } from './leetcode';
import type { NewSolve } from './srs';
import { supabase } from './supabase';

export interface RecordResult {
  received: number;
  in_catalog: number;
  new: number;
  new_topics: number;
}

export interface RecordSolvesResult extends RecordResult {
  // Solves that are new or newer than what was stored.
  advanced: NewSolve[];
}

export async function recordSolves(solves: SolvedProblem[], source: 'import' | 'sync'): Promise<RecordSolvesResult> {
  const { data, error } = await supabase.rpc('record_solves', {
    p_solves: solves.map((s) => ({ slug: s.slug, solved_at: s.solvedAt })),
    p_source: source,
  });
  if (error) throw error;
  const { advanced, ...counts } = data as RecordResult & {
    advanced: { slug: string; topic: string; solved_at: string }[];
  };
  return { ...counts, advanced: advanced.map((a) => ({ slug: a.slug, topic: a.topic, solvedAt: a.solved_at })) };
}

export interface SyncStatus {
  lastImportAt: string | null;
  lastImport: RecordResult | null;
  lastSyncAt: string | null;
  lastError: string | null;
}

export const syncStatus = storage.defineItem<SyncStatus>('local:syncStatus', {
  fallback: { lastImportAt: null, lastImport: null, lastSyncAt: null, lastError: null },
});
