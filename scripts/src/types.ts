export type ListId = 'blind75' | 'neetcode150' | 'striver_a2z';

export const LISTS: Record<ListId, string> = {
  blind75: 'Blind 75',
  neetcode150: 'NeetCode 150',
  striver_a2z: "Striver's A2Z DSA Sheet",
};

// One problem as it appears in one list. The same slug can appear in several lists.
export interface ListEntry {
  list: ListId;
  slug: string;
  title: string;
  section: string;
  subsection: string | null;
  position: number;
}

export interface Problem {
  slug: string;
  lc_id: number;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topic: string;
  tags: string[];
  is_paid: boolean;
}
