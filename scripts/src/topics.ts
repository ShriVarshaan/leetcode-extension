import type { ListEntry } from './types.ts';

// Canonical revision topics (NeetCode's roadmap categories). Spaced repetition runs per topic.
export const TOPICS = [
  'Arrays & Hashing',
  'Two Pointers',
  'Sliding Window',
  'Stack',
  'Binary Search',
  'Linked List',
  'Trees',
  'Tries',
  'Heap / Priority Queue',
  'Backtracking',
  'Graphs',
  'Advanced Graphs',
  '1-D Dynamic Programming',
  '2-D Dynamic Programming',
  'Greedy',
  'Intervals',
  'Math & Geometry',
  'Bit Manipulation',
] as const;

export type Topic = (typeof TOPICS)[number];

// Striver A2Z step -> topic. Steps whose topic depends on the sub-step are handled in topicFromA2Z.
const A2Z_STEPS: Record<string, Topic> = {
  'Sorting': 'Arrays & Hashing',
  'Arrays': 'Arrays & Hashing',
  'Hashing': 'Arrays & Hashing',
  'Binary Search': 'Binary Search',
  'Strings (Basic and Medium)': 'Arrays & Hashing',
  'Recursion': 'Backtracking',
  'Linked-List': 'Linked List',
  'Bit Manipulation': 'Bit Manipulation',
  'Greedy Algorithms': 'Greedy',
  'Stack / Queues': 'Stack',
  'Binary Trees': 'Trees',
  'Binary Search Trees': 'Trees',
  'Heaps': 'Heap / Priority Queue',
  'Tries': 'Tries',
  'Strings (Advanced Algo)': 'Arrays & Hashing',
  'Maths': 'Math & Geometry',
};

const A2Z_SUBSTEPS: Record<string, Topic> = {
  // Beginner Problems
  'Basic Maths': 'Math & Geometry',
  'Basic Hashing': 'Arrays & Hashing',
  'Basic Strings': 'Arrays & Hashing',
  'Basic Arrays': 'Arrays & Hashing',
  // Graphs
  'Shortest Path Algorithms': 'Advanced Graphs',
  'Minimum Spanning Tree': 'Advanced Graphs',
  'Hard Problems II': 'Advanced Graphs',
  'Additional Algorithms': 'Advanced Graphs',
  // Dynamic Programming
  '1D DP': '1-D Dynamic Programming',
  'DP on stocks': '1-D Dynamic Programming',
  'LIS': '1-D Dynamic Programming',
};

function topicFromA2Z(entry: ListEntry, tags: string[]): Topic | null {
  if (entry.subsection && A2Z_SUBSTEPS[entry.subsection]) return A2Z_SUBSTEPS[entry.subsection];
  if (entry.section === 'Graphs') return 'Graphs';
  if (entry.section === 'Dynamic Programming') return '2-D Dynamic Programming';
  if (entry.section === 'Sliding Window / 2 Pointer') {
    return tags.includes('sliding-window') ? 'Sliding Window' : 'Two Pointers';
  }
  return A2Z_STEPS[entry.section] ?? null;
}

// Fallback: first matching LeetCode tag, most specific first.
const TAG_PRIORITY: [string, Topic][] = [
  ['trie', 'Tries'],
  ['interval', 'Intervals'],
  ['shortest-path', 'Advanced Graphs'],
  ['minimum-spanning-tree', 'Advanced Graphs'],
  ['topological-sort', 'Graphs'],
  ['union-find', 'Graphs'],
  ['graph', 'Graphs'],
  ['dynamic-programming', '1-D Dynamic Programming'],
  ['backtracking', 'Backtracking'],
  ['heap-priority-queue', 'Heap / Priority Queue'],
  ['tree', 'Trees'],
  ['binary-tree', 'Trees'],
  ['linked-list', 'Linked List'],
  ['sliding-window', 'Sliding Window'],
  ['binary-search', 'Binary Search'],
  ['stack', 'Stack'],
  ['monotonic-stack', 'Stack'],
  ['bit-manipulation', 'Bit Manipulation'],
  ['two-pointers', 'Two Pointers'],
  ['greedy', 'Greedy'],
  ['recursion', 'Backtracking'],
  ['math', 'Math & Geometry'],
  ['geometry', 'Math & Geometry'],
];

// Priority: NeetCode's own category > Striver step > LeetCode tags.
export function pickTopic(
  neetcodePattern: string | undefined,
  a2zEntry: ListEntry | undefined,
  tags: string[],
): Topic {
  if (neetcodePattern && (TOPICS as readonly string[]).includes(neetcodePattern)) {
    return neetcodePattern as Topic;
  }
  const fromA2Z = a2zEntry ? topicFromA2Z(a2zEntry, tags) : null;
  if (fromA2Z) return fromA2Z;
  for (const [tag, topic] of TAG_PRIORITY) if (tags.includes(tag)) return topic;
  return 'Arrays & Hashing';
}
