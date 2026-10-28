import { describe, expect, it } from 'vitest';
import { checkSubmission } from './check';
import { explain } from './explain';
import { POOL, TIERS, TUTORIAL, TUTORIALS, tierPuzzles } from './pool';
import { countIfFalse, gridsEqual, ruleHolds, solveAll, RULE_IDS } from './solver';
import type { Grid, RuleId } from './types';

const clone = (g: Grid) => g.map((r) => [...r]) as Grid;

describe('solver sanity', () => {
  it('counts the known 288 standard 4x4 Sudoku grids from an empty board', () => {
    const empty: Grid = [0, 0, 0, 0].map(() => [0, 0, 0, 0]) as Grid;
    expect(solveAll(empty, ['A', 'B', 'C'])).toHaveLength(288);
  });
});

/** The two tutorials are pinned exactly; every other puzzle is checked generically below. */
const TUTORIAL_EXPECTED: Record<string, RuleId> = { 'tutorial-001': 'A', 'level-002': 'C' };

describe('pool', () => {
  it('starts with Level 1 then Level 2 as the tutorials, unchanged', () => {
    expect(TUTORIALS.map((p) => p.id)).toEqual(['tutorial-001', 'level-002']);
    for (const p of TUTORIALS) expect(p.falseRuleId).toBe(TUTORIAL_EXPECTED[p.id]);
  });

  it('has unique ids and case numbers', () => {
    expect(new Set(POOL.map((p) => p.id)).size).toBe(POOL.length);
    expect(new Set(POOL.map((p) => p.caseNumber)).size).toBe(POOL.length);
  });

  it('never serves tutorials or drafts from a tier', () => {
    for (const t of TIERS) for (const p of tierPuzzles(t)) expect(p.status).toBe('live');
  });

  it('has at most 3 new puzzles per tier', () => {
    for (const t of TIERS) expect(tierPuzzles(t).length).toBeLessThanOrEqual(3);
  });
});

describe.each(POOL.map((p) => [p.name, p] as const))('%s: always-truthful contract', (_name, p) => {
  const expected = Object.fromEntries(RULE_IDS.map((id) => [id, id === p.falseRuleId ? 1 : 0]));

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

  it('has exactly three rule cards A, B, C', () => {
    expect(p.rules.map((r) => r.id)).toEqual(['A', 'B', 'C']);
  });

  it.each(RULE_IDS)('if %s is false (other two enforced): expected completion count', (id) => {
    expect(countIfFalse(p.givens, id)).toHaveLength(expected[id]);
  });

  it('standard Sudoku (A+B+C enforced): 0 completions', () => {
    expect(solveAll(p.givens, ['A', 'B', 'C'])).toHaveLength(0);
  });

  it('the unique completion equals the stored solution', () => {
    const [only] = countIfFalse(p.givens, p.falseRuleId);
    expect(gridsEqual(only, p.solution)).toBe(true);
  });

  it('the stored solution violates the liar and satisfies the other two', () => {
    for (const id of RULE_IDS) expect(ruleHolds(p.solution, id)).toBe(id !== p.falseRuleId);
  });

  it('win text names the liar and no other rule as lying', () => {
    const text = explain(p);
    expect(text).toContain(`Rule ${p.falseRuleId}`);
    for (const id of RULE_IDS) if (id !== p.falseRuleId) expect(text).not.toContain(`Rule ${id} lied`);
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
