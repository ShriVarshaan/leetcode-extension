import type { SolvedProblem } from './leetcode';
import type { RecordResult } from './solves';

// Messages between the extension's parts. Each has a `type` so receivers can switch on it.

// options page -> background
export type ImportHistoryRequest = { type: 'import-history' };
export type ImportHistoryResponse =
  | { ok: true; username: string; result: RecordResult }
  | { ok: false; error: string };

// leetcode.com content script -> background
export type SolveDetected = { type: 'solve-detected'; slug: string };

// background -> leetcode.com content script
export type PingRequest = { type: 'lc-ping' };
export type CollectSolvedRequest = { type: 'lc-collect-solved' };
export type CollectSolvedResponse =
  | { ok: true; username: string; solved: SolvedProblem[] }
  | { ok: false; error: string };

export type BackgroundMessage = ImportHistoryRequest | SolveDetected;
export type ContentMessage = PingRequest | CollectSolvedRequest;
