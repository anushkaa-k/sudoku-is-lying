/** 0 = empty cell; otherwise a digit 1..size. */
export type Cell = number;
export type Grid = Cell[][];

/** Board side length. Each tier has its own: Easy 4, Medium 6, Hard 9. */
export type BoardSize = 4 | 6 | 9;

/** Box shape in cells: `rows` high by `cols` wide. rows * cols === size. */
export interface BoxShape {
  rows: number;
  cols: number;
}

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
  size: BoardSize;
  box: BoxShape;
  givens: Grid;
  rules: RuleCard[];
  falseRuleId: RuleId;
  solution: Grid;
  /** Shown only after a correct solve. Generated from the solution when omitted. */
  explanation?: string;
}
