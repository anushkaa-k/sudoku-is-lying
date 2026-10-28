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

export interface Puzzle {
  id: string;
  caseNumber: string;
  /** Small label above the headline, e.g. "Level 1: Tutorial". */
  label: string;
  givens: Grid;
  rules: RuleCard[];
  falseRuleId: RuleId;
  solution: Grid;
  /** Shown only after a correct solve. */
  explanation: string;
}
