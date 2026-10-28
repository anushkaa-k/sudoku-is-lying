import { describe, expect, it } from 'vitest';
import { checkSubmission } from './check';
import { PUZZLES, TUTORIAL } from './puzzles';
import { countIfFalse, gridsEqual, ruleHolds, solveAll, RULE_IDS } from './solver';
import type { Grid } from './types';

const clone = (g: Grid) => g.map((r) => [...r]) as Grid;

describe('solver sanity', () => {
  it('counts the known 288 standard 4x4 Sudoku grids from an empty board', () => {
    const empty: Grid = [0, 0, 0, 0].map(() => [0, 0, 0, 0]) as Grid;
    expect(solveAll(empty, ['A', 'B', 'C'])).toHaveLength(288);
  });
});

describe('tutorial puzzle: always-truthful contract', () => {
  const p = TUTORIAL;

  it('uses only digits 0-4 in givens and 1-4 in the solution', () => {
    expect(p.givens.flat().every((v) => v >= 0 && v <= 4)).toBe(true);
    expect(p.solution.flat().every((v) => v >= 1 && v <= 4)).toBe(true);
  });

  it('solution keeps every given unchanged', () => {
    p.givens.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v !== 0) expect(p.solution[r][c]).toBe(v);
      }),
    );
  });

  it('has exactly three rule cards with the false one among them', () => {
    expect(p.rules.map((r) => r.id)).toEqual(['A', 'B', 'C']);
    expect(RULE_IDS).toContain(p.falseRuleId);
  });

  it('if A is false (B+C enforced): exactly 1 completion', () => {
    expect(countIfFalse(p.givens, 'A')).toHaveLength(1);
  });

  it('if B is false (A+C enforced): 0 completions', () => {
    expect(countIfFalse(p.givens, 'B')).toHaveLength(0);
  });

  it('if C is false (A+B enforced): 0 completions', () => {
    expect(countIfFalse(p.givens, 'C')).toHaveLength(0);
  });

  it('standard Sudoku (A+B+C enforced): 0 completions', () => {
    expect(solveAll(p.givens, ['A', 'B', 'C'])).toHaveLength(0);
  });

  it('the unique completion equals the stored solution', () => {
    const [only] = countIfFalse(p.givens, 'A');
    expect(gridsEqual(only, p.solution)).toBe(true);
  });

  it('the unique completion actually violates A and satisfies B and C', () => {
    expect(ruleHolds(p.solution, 'A')).toBe(false);
    expect(ruleHolds(p.solution, 'B')).toBe(true);
    expect(ruleHolds(p.solution, 'C')).toBe(true);
  });

  it('every shipped puzzle has exactly one viable false card', () => {
    for (const puzzle of PUZZLES) {
      const counts = RULE_IDS.map((id) => countIfFalse(puzzle.givens, id).length);
      expect(counts.filter((n) => n > 0)).toEqual([1]);
      expect(countIfFalse(puzzle.givens, puzzle.falseRuleId)).toHaveLength(1);
    }
  });
});

describe('checkSubmission', () => {
  const p = TUTORIAL;

  it('incomplete grid -> incomplete, regardless of suspect', () => {
    expect(checkSubmission(p, clone(p.givens), 'A')).toBe('incomplete');
    expect(checkSubmission(p, clone(p.givens), null)).toBe('incomplete');
  });

  it('complete grid, no suspect -> no-suspect', () => {
    expect(checkSubmission(p, clone(p.solution), null)).toBe('no-suspect');
  });

  it('correct grid + correct suspect -> solved', () => {
    expect(checkSubmission(p, clone(p.solution), 'A')).toBe('solved');
  });

  it('correct grid + wrong suspect -> wrong', () => {
    expect(checkSubmission(p, clone(p.solution), 'B')).toBe('wrong');
    expect(checkSubmission(p, clone(p.solution), 'C')).toBe('wrong');
  });

  it('wrong grid + correct suspect -> wrong', () => {
    const g = clone(p.solution);
    g[0][2] = 3;
    expect(checkSubmission(p, g, 'A')).toBe('wrong');
  });
});
