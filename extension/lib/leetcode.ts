// All leetcode.com calls live here. LeetCode's API is undocumented and may change.
//
// Two kinds of call:
// - Public (recent accepted submissions by username): safe from any context, sent without cookies.
// - Authenticated (who's signed in, full solved list): must run in the leetcode.com content
//   script, where requests are same-origin and carry the user's LeetCode login.

const GRAPHQL_URL = 'https://leetcode.com/graphql';

export interface SolvedProblem {
  slug: string;
  solvedAt: string; // ISO timestamp
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

async function graphql<T>(query: string, variables: Record<string, unknown>, authenticated: boolean): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authenticated) {
    // LeetCode (Django) expects the CSRF cookie echoed back as a header on logged-in POSTs.
    const csrf = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)?.[1];
    if (csrf) headers['x-csrftoken'] = csrf;
  }
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
    credentials: authenticated ? 'include' : 'omit',
  });
  if (!res.ok) throw new Error(`LeetCode returned HTTP ${res.status}`);
  const json = (await res.json()) as GraphQLResponse<T>;
  const firstError = json.errors?.[0];
  if (firstError) throw new Error(`LeetCode: ${firstError.message}`);
  if (!json.data) throw new Error('LeetCode returned no data');
  return json.data;
}

// LeetCode timestamps come as unix seconds (sometimes as strings) or ISO strings.
function toIso(value: unknown): string {
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
    const n = Number(value);
    return new Date(n < 1e12 ? n * 1000 : n).toISOString();
  }
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return new Date().toISOString();
}

// Public: the user's last 20 accepted submissions (LeetCode caps this at 20).
export async function fetchRecentAccepted(username: string): Promise<SolvedProblem[]> {
  const data = await graphql<{ recentAcSubmissionList: { titleSlug: string; timestamp: string }[] | null }>(
    `query recentAc($username: String!) {
      recentAcSubmissionList(username: $username, limit: 20) { titleSlug timestamp }
    }`,
    { username },
    false,
  );
  if (!data.recentAcSubmissionList) throw new Error(`LeetCode user "${username}" not found`);
  return data.recentAcSubmissionList.map((s) => ({ slug: s.titleSlug, solvedAt: toIso(s.timestamp) }));
}

// Authenticated (content script only).
export async function fetchSignedInUser(): Promise<string | null> {
  const data = await graphql<{ userStatus: { isSignedIn: boolean; username: string } }>(
    `query { userStatus { isSignedIn username } }`,
    {},
    true,
  );
  return data.userStatus.isSignedIn ? data.userStatus.username : null;
}

// Authenticated (content script only): every problem the signed-in user has solved.
export async function fetchAllSolved(): Promise<SolvedProblem[]> {
  try {
    const fromProgress = await fetchSolvedFromProgressList();
    if (fromProgress.length) return fromProgress;
  } catch (e) {
    console.warn('LeetCode progress list failed, falling back to problem list', e);
  }
  return fetchSolvedFromProblemList();
}

// Preferred source: includes when each problem was last submitted.
async function fetchSolvedFromProgressList(): Promise<SolvedProblem[]> {
  const solved: SolvedProblem[] = [];
  const pageSize = 100;
  for (let skip = 0; skip < 10_000; skip += pageSize) {
    const data = await graphql<{
      userProgressQuestionList: {
        totalNum: number;
        questions: { titleSlug: string; lastSubmittedAt: unknown }[];
      } | null;
    }>(
      `query progress($filters: UserProgressQuestionListInput) {
        userProgressQuestionList(filters: $filters) {
          totalNum
          questions { titleSlug lastSubmittedAt }
        }
      }`,
      { filters: { skip, limit: pageSize, questionStatus: 'SOLVED' } },
      true,
    );
    const page = data.userProgressQuestionList;
    if (!page) break;
    solved.push(...page.questions.map((q) => ({ slug: q.titleSlug, solvedAt: toIso(q.lastSubmittedAt) })));
    if (page.questions.length < pageSize || solved.length >= page.totalNum) break;
  }
  return solved;
}

// Fallback: marks solved problems but has no dates, so "now" is used.
async function fetchSolvedFromProblemList(): Promise<SolvedProblem[]> {
  const res = await fetch('https://leetcode.com/api/problems/all/', { credentials: 'include' });
  if (!res.ok) throw new Error(`LeetCode problem list returned HTTP ${res.status}`);
  const data = (await res.json()) as {
    stat_status_pairs: { status: string | null; stat: { question__title_slug: string } }[];
  };
  const now = new Date().toISOString();
  return data.stat_status_pairs
    .filter((p) => p.status === 'ac')
    .map((p) => ({ slug: p.stat.question__title_slug, solvedAt: now }));
}
