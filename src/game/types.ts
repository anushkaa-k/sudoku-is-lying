export type Digit = 1 | 2 | 3 | 4;
/** 0 = empty cell. */
export type Cell = 0 | Digit;
export type Grid = Cell[][];

export type RuleId = 'A' | 'B' | 'C';

export interface RuleCard {
  id: RuleId;
  /** Short text printed on the card. */
  text: string;
}

export type Tier = 'easy' | 'medium' | 'hard';

/**
 * tutorial: played first, in pool order, by a brand-new player.
 * live: served from its tier on the difficulty screen.
 * draft: kept out of the game until it passes verification.
 */
export type PuzzleStatus = 'tutorial' | 'live' | 'draft';

export interface Puzzle {
  id: string;
  /** Shown next to the case tag, e.g. "Level 1: Tutorial". */
  name: string;
  caseNumber: string;
  /** Draft label; adjust after playtesting. */
  tier: Tier;
  status: PuzzleStatus;
  givens: Grid;
  rules: RuleCard[];
  falseRuleId: RuleId;
  solution: Grid;
  /** Shown only after a correct solve. Generated from the solution when omitted. */
  explanation?: string;
}
