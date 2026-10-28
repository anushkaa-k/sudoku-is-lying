import type { Grid, Puzzle, RuleCard, RuleId, Tier } from './types';

export const RULE_CARDS: RuleCard[] = [
  { id: 'A', text: 'Every row has 1, 2, 3, 4 exactly once.' },
  { id: 'B', text: 'Every column has 1, 2, 3, 4 exactly once.' },
  { id: 'C', text: 'Every outlined 2×2 box has 1, 2, 3, 4 exactly once.' },
];

export const TUTORIAL: Puzzle = {
  id: 'tutorial-001',
  name: 'Level 1: Tutorial',
  caseNumber: '001',
  tier: 'easy',
  status: 'tutorial',
  givens: [
    [1, 2, 0, 0],
    [0, 0, 3, 4],
    [0, 0, 0, 1],
    [4, 3, 4, 0],
  ],
  rules: RULE_CARDS,
  falseRuleId: 'A',
  solution: [
    [1, 2, 1, 2],
    [3, 4, 3, 4],
    [2, 1, 2, 1],
    [4, 3, 4, 3],
  ],
  explanation:
    'Look at row 4: two 4s, both fixed in ink. A row can’t hold 1–4 exactly once with two 4s in it, so Rule A was bluffing the whole time. Columns and boxes told the truth, and they alone pin down every tile.',
};

export const LEVEL_2: Puzzle = {
  id: 'level-002',
  name: 'Level 2',
  caseNumber: '002',
  tier: 'medium',
  status: 'tutorial',
  givens: [
    [0, 0, 0, 3],
    [2, 4, 0, 0],
    [1, 0, 2, 0],
    [0, 0, 4, 0],
  ],
  rules: RULE_CARDS,
  falseRuleId: 'C',
  solution: [
    [4, 2, 1, 3],
    [2, 4, 3, 1],
    [1, 3, 2, 4],
    [3, 1, 4, 2],
  ],
  explanation:
    'Rule C lied. Rows and columns hold, but the 2×2 boxes repeat digits: the top-left box is 4, 2, 2, 4. No fixed tile gave it away this time. Trust A and B and the grid has exactly one answer; trust C and it falls apart. Very smug of it.',
};

/** New puzzles, found by scripts/search-puzzles.ts and checked by scripts/verify-levels.ts. */
const casePuzzle = (
  n: number,
  name: string,
  tier: Tier,
  falseRuleId: RuleId,
  givens: Grid,
  solution: Grid,
): Puzzle => ({
  id: `case-${String(n).padStart(3, '0')}`,
  name,
  caseNumber: String(n).padStart(3, '0'),
  tier,
  status: 'live',
  givens,
  rules: RULE_CARDS,
  falseRuleId,
  solution,
});

// prettier-ignore
const CASES: Puzzle[] = [
  casePuzzle(3, 'The Usual Suspects', 'easy', 'A',
    [[0,4,4,0],[2,1,2,3],[4,0,0,4],[0,2,3,0]],
    [[3,4,4,1],[2,1,2,3],[4,3,1,4],[1,2,3,2]]),
  casePuzzle(4, 'Red Herring', 'easy', 'B',
    [[4,0,2,0],[2,3,4,0],[2,4,0,1],[1,0,0,2]],
    [[4,1,2,3],[2,3,4,1],[2,4,3,1],[1,3,4,2]]),
  casePuzzle(5, 'Fine Print', 'easy', 'C',
    [[2,1,0,0],[0,2,0,1],[3,4,0,2],[0,0,2,4]],
    [[2,1,4,3],[4,2,3,1],[3,4,1,2],[1,3,2,4]]),
  casePuzzle(6, 'Alibi', 'medium', 'A',
    [[2,4,3,0],[0,3,0,1],[0,1,4,0],[3,0,1,2]],
    [[2,4,3,4],[1,3,2,1],[4,1,4,3],[3,2,1,2]]),
  casePuzzle(7, 'Paper Trail', 'medium', 'B',
    [[2,0,4,3],[3,0,0,2],[0,4,3,0],[0,2,1,4]],
    [[2,1,4,3],[3,4,1,2],[1,4,3,2],[3,2,1,4]]),
  casePuzzle(8, 'Loose Ends', 'medium', 'C',
    [[0,1,3,0],[0,2,4,0],[0,3,2,1],[0,4,0,0]],
    [[2,1,3,4],[1,2,4,3],[4,3,2,1],[3,4,1,2]]),
  casePuzzle(9, 'Cold Case', 'hard', 'A',
    [[0,0,0,0],[2,1,4,3],[0,0,3,2],[4,2,0,0]],
    [[3,4,2,1],[2,1,4,3],[1,3,3,2],[4,2,1,4]]),
  casePuzzle(10, 'Inside Job', 'hard', 'B',
    [[4,0,2,0],[3,0,4,0],[1,0,0,3],[0,4,1,0]],
    [[4,1,2,3],[3,2,4,1],[1,2,4,3],[3,4,1,2]]),
  casePuzzle(11, 'Smoking Gun', 'hard', 'C',
    [[0,0,1,0],[0,0,3,0],[0,0,0,4],[1,2,0,0]],
    [[4,3,1,2],[2,4,3,1],[3,1,2,4],[1,2,4,3]]),
];

/** Every puzzle. Verified as a whole by `npm run verify`. */
export const POOL: Puzzle[] = [TUTORIAL, LEVEL_2, ...CASES];

/** Tutorial puzzles, in the order a new player meets them. */
export const TUTORIALS = POOL.filter((p) => p.status === 'tutorial');

export const TIERS: Tier[] = ['easy', 'medium', 'hard'];

/** Puzzles the difficulty screen may serve for a tier (tutorials and drafts excluded). */
export const tierPuzzles = (tier: Tier) => POOL.filter((p) => p.status === 'live' && p.tier === tier);
