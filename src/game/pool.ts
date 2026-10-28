import type { BoardSize, BoxShape, Grid, Puzzle, RuleCard, RuleId, Tier } from './types';

/** Rule cards for the 4x4 board (Easy and the tutorials); wording unchanged. */
export const RULE_CARDS: RuleCard[] = [
  { id: 'A', text: 'Every row has 1, 2, 3, 4 exactly once.' },
  { id: 'B', text: 'Every column has 1, 2, 3, 4 exactly once.' },
  { id: 'C', text: 'Every outlined 2×2 box has 1, 2, 3, 4 exactly once.' },
];

/** Rule cards for the larger boards. */
const rulesFor = (size: BoardSize): RuleCard[] => [
  { id: 'A', text: `Every row has 1–${size} exactly once.` },
  { id: 'B', text: `Every column has 1–${size} exactly once.` },
  { id: 'C', text: `Every outlined box has 1–${size} exactly once.` },
];

const BOX_4: BoxShape = { rows: 2, cols: 2 };
/** 6x6 boxes are 2 cells high by 3 wide (flip to { rows: 3, cols: 2 } to stand them up). */
const BOX_6: BoxShape = { rows: 2, cols: 3 };
const BOX_9: BoxShape = { rows: 3, cols: 3 };

export const TUTORIAL: Puzzle = {
  id: 'tutorial-001',
  name: 'Level 1: Tutorial',
  caseNumber: '001',
  tier: 'easy',
  status: 'tutorial',
  size: 4,
  box: BOX_4,
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
  size: 4,
  box: BOX_4,
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

/** 4x4 cases, found by scripts/search-puzzles.ts and checked by scripts/verify-levels.ts. */
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
  size: 4,
  box: BOX_4,
  givens,
  rules: RULE_CARDS,
  falseRuleId,
  solution,
});

// prettier-ignore
const CASES: Puzzle[] = [
  // Cases 006-011 were Medium/Hard while every tier was 4x4. Board size now sets the
  // tier, so they stay in Easy with their content and ids unchanged.
  casePuzzle(3, 'The Usual Suspects', 'easy', 'A',
    [[0,4,4,0],[2,1,2,3],[4,0,0,4],[0,2,3,0]],
    [[3,4,4,1],[2,1,2,3],[4,3,1,4],[1,2,3,2]]),
  casePuzzle(4, 'Red Herring', 'easy', 'B',
    [[4,0,2,0],[2,3,4,0],[2,4,0,1],[1,0,0,2]],
    [[4,1,2,3],[2,3,4,1],[2,4,3,1],[1,3,4,2]]),
  casePuzzle(5, 'Fine Print', 'easy', 'C',
    [[2,1,0,0],[0,2,0,1],[3,4,0,2],[0,0,2,4]],
    [[2,1,4,3],[4,2,3,1],[3,4,1,2],[1,3,2,4]]),
  casePuzzle(6, 'Alibi', 'easy', 'A',
    [[2,4,3,0],[0,3,0,1],[0,1,4,0],[3,0,1,2]],
    [[2,4,3,4],[1,3,2,1],[4,1,4,3],[3,2,1,2]]),
  casePuzzle(7, 'Paper Trail', 'easy', 'B',
    [[2,0,4,3],[3,0,0,2],[0,4,3,0],[0,2,1,4]],
    [[2,1,4,3],[3,4,1,2],[1,4,3,2],[3,2,1,4]]),
  casePuzzle(8, 'Loose Ends', 'easy', 'C',
    [[0,1,3,0],[0,2,4,0],[0,3,2,1],[0,4,0,0]],
    [[2,1,3,4],[1,2,4,3],[4,3,2,1],[3,4,1,2]]),
  casePuzzle(9, 'Cold Case', 'easy', 'A',
    [[0,0,0,0],[2,1,4,3],[0,0,3,2],[4,2,0,0]],
    [[3,4,2,1],[2,1,4,3],[1,3,3,2],[4,2,1,4]]),
  casePuzzle(10, 'Inside Job', 'easy', 'B',
    [[4,0,2,0],[3,0,4,0],[1,0,0,3],[0,4,1,0]],
    [[4,1,2,3],[3,2,4,1],[1,2,4,3],[3,4,1,2]]),
  casePuzzle(11, 'Smoking Gun', 'easy', 'C',
    [[0,0,1,0],[0,0,3,0],[0,0,0,4],[1,2,0,0]],
    [[4,3,1,2],[2,4,3,1],[3,1,2,4],[1,2,4,3]]),
];

/** Parses rows of digit characters ('0' = empty) into a grid. */
const parse = (rows: string[]): Grid => rows.map((r) => [...r].map(Number));

/** 6x6 and 9x9 cases: digits as strings, one per row, '0' = empty. */
const bigCase = (
  n: number,
  name: string,
  tier: Tier,
  size: 6 | 9,
  falseRuleId: RuleId,
  givens: string[],
  solution: string[],
): Puzzle => ({
  id: `case-${String(n).padStart(3, '0')}`,
  name,
  caseNumber: String(n).padStart(3, '0'),
  tier,
  status: 'live',
  size,
  box: size === 6 ? BOX_6 : BOX_9,
  givens: parse(givens),
  rules: rulesFor(size),
  falseRuleId,
  solution: parse(solution),
});

// Found by `npm run search -- 6 40 subtle 24` and `npm run search -- 9 30 subtle 54`.
// Every liar in a tier gets the same clue count so the count can't hint at the liar.
// prettier-ignore
const BIG_CASES: Puzzle[] = [
  bigCase(12, 'Double Booking', 'medium', 6, 'A',
    ['016403',
     '403152',
     '500001',
     '041235',
     '024516',
     '160300'],
    ['216463',
     '453152',
     '532641',
     '641235',
     '324516',
     '165324']),
  bigCase(13, 'Tall Tale', 'medium', 6, 'B',
    ['406302',
     '230056',
     '503204',
     '102560',
     '304605',
     '605130'],
    ['456312',
     '231456',
     '563214',
     '142563',
     '314625',
     '625134']),
  bigCase(14, 'Cover Story', 'medium', 6, 'C',
    ['510003',
     '630254',
     '060001',
     '204306',
     '345162',
     '106430'],
    ['512643',
     '631254',
     '463521',
     '254316',
     '345162',
     '126435']),
  bigCase(15, 'The Long Con', 'hard', 9, 'A',
    ['613807050',
     '704050268',
     '090462107',
     '060279003',
     '209500670',
     '487036592',
     '370615489',
     '006920015',
     '951004300'],
    ['613897954',
     '724351268',
     '598462137',
     '165279843',
     '239548671',
     '487136592',
     '372615489',
     '846923715',
     '951784326']),
  bigCase(16, 'Grand Jury', 'hard', 9, 'B',
    ['041089306',
     '028076045',
     '906203180',
     '093708260',
     '204061073',
     '507024801',
     '609430058',
     '402015609',
     '035092014'],
    ['741589326',
     '328176945',
     '956243187',
     '193758264',
     '284961573',
     '567324891',
     '619437258',
     '472815639',
     '835692714']),
  bigCase(17, 'Last Word', 'hard', 9, 'C',
    ['241536890',
     '900812046',
     '300074001',
     '506040312',
     '802100070',
     '710328469',
     '079260183',
     '024951700',
     '060407025'],
    ['241536897',
     '937812546',
     '398674251',
     '586749312',
     '852193674',
     '715328469',
     '479265183',
     '624951738',
     '163487925']),
];

/** Board size each tier serves. */
export const TIER_SIZE: Record<Tier, BoardSize> = { easy: 4, medium: 6, hard: 9 };

/** Every puzzle. Verified as a whole by `npm run verify`. */
export const POOL: Puzzle[] = [TUTORIAL, LEVEL_2, ...CASES, ...BIG_CASES];

/** Tutorial puzzles, in the order a new player meets them. */
export const TUTORIALS = POOL.filter((p) => p.status === 'tutorial');

export const TIERS: Tier[] = ['easy', 'medium', 'hard'];

/** Puzzles the difficulty screen may serve for a tier (tutorials and drafts excluded). */
export const tierPuzzles = (tier: Tier) => POOL.filter((p) => p.status === 'live' && p.tier === tier);
