// Turns low-level errors into messages a user can act on.
export function friendlyError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'You\'re offline. Picks will update when you reconnect.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return 'Couldn\'t reach the server. Check your connection and try again.';
  if (/JWT expired|Not signed in|refresh token/i.test(message)) return 'Your session has expired. Sign in again in Settings.';
  if (/LeetCode returned HTTP 429/.test(message)) return 'LeetCode is rate-limiting requests. Sync will retry later.';
  return message;
}
