import { storage } from 'wxt/utils/storage';
import type { SolvedProblem } from './leetcode';
import { supabase } from './supabase';

export interface RecordResult {
  received: number;
  in_catalog: number;
  new: number;
  new_topics: number;
}

export async function recordSolves(solves: SolvedProblem[], source: 'import' | 'sync'): Promise<RecordResult> {
  const { data, error } = await supabase.rpc('record_solves', {
    p_solves: solves.map((s) => ({ slug: s.slug, solved_at: s.solvedAt })),
    p_source: source,
  });
  if (error) throw error;
  return data as RecordResult;
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
