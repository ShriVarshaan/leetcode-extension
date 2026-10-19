import type { DailyRecs } from './daily';
import type { SolvedProblem } from './leetcode';
import type { RecordResult } from './solves';
import type { Rating } from './srs';

// Messages between the extension's parts. Each has a `type` so receivers can switch on it.

// options page -> background
export type ImportHistoryRequest = { type: 'import-history' };
export type ImportHistoryResponse =
  | { ok: true; username: string; result: RecordResult }
  | { ok: false; error: string };
export type SettingsChanged = { type: 'settings-changed' };

// popup / leetcode.com content script -> background
export type RatePickRequest = { type: 'rate-pick'; slug: string; rating: Rating };
export type TodayResponse = { ok: true; recs: DailyRecs } | { ok: false; error: string };
export type EnsureTodayRequest = { type: 'ensure-today' };
export type PickAgainRequest = { type: 'pick-again' };

// leetcode.com content script -> background
export type SolveDetected = { type: 'solve-detected'; slug: string };

// background -> leetcode.com content script
export type PingRequest = { type: 'lc-ping' };
export type CollectSolvedRequest = { type: 'lc-collect-solved' };
export type CollectSolvedResponse =
  | { ok: true; username: string; solved: SolvedProblem[] }
  | { ok: false; error: string };

export type BackgroundMessage =
  | ImportHistoryRequest
  | SettingsChanged
  | RatePickRequest
  | EnsureTodayRequest
  | PickAgainRequest
  | SolveDetected;
export type ContentMessage = PingRequest | CollectSolvedRequest;
