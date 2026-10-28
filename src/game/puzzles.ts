import type { Puzzle, RuleCard } from './types';

export const RULE_CARDS: RuleCard[] = [
  { id: 'A', text: 'Every row has 1, 2, 3, 4 exactly once.' },
  { id: 'B', text: 'Every column has 1, 2, 3, 4 exactly once.' },
  { id: 'C', text: 'Every outlined 2×2 box has 1, 2, 3, 4 exactly once.' },
];

export const TUTORIAL: Puzzle = {
  id: 'tutorial-001',
  caseNumber: '001',
  label: 'Level 1: Tutorial',
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
  caseNumber: '002',
  label: 'Level 2',
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

/** Played in order. Add new levels to the end. */
export const LEVELS: Puzzle[] = [TUTORIAL, LEVEL_2];
