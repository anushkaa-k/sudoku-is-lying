import { gridsEqual, isComplete } from './solver';
import type { Grid, Puzzle, RuleId } from './types';

export type CheckResult = 'incomplete' | 'no-suspect' | 'wrong' | 'solved';

/**
 * Deliberately vague on failure: never says which part is wrong,
 * and never reveals which rule is true or false.
 */
export function checkSubmission(puzzle: Puzzle, grid: Grid, suspect: RuleId | null): CheckResult {
  if (!isComplete(grid)) return 'incomplete';
  if (suspect === null) return 'no-suspect';
  if (suspect === puzzle.falseRuleId && gridsEqual(grid, puzzle.solution)) return 'solved';
  return 'wrong';
}
