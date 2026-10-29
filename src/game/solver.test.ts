import { beforeEach, describe, expect, it } from 'vitest';
import { countSolutions, DEFAULT_BUDGET, gate, holds, logicSolve, type Geometry } from '../../scripts/lib/checker';
import { checkSubmission } from './check';
import { explain } from './explain';
import { POOL, TIER_SIZE, TIERS, TUTORIAL, TUTORIALS, tierPuzzles } from './pool';
import { fingerprint, loadSolved, recordKey, saveFlag, saveSolved, TUTORIAL_DONE_FLAG, tutorialSettled } from './progress';
import { digitsFor, groupsFor, ruleHolds, RULE_IDS } from './solver';
import type { Grid, Puzzle, RuleId } from './types';

const clone = (g: Grid) => g.map((r) => [...r]) as Grid;
const geoOf = (p: Puzzle): Geometry => ({ size: p.size, boxRows: p.box.rows, boxCols: p.box.cols });

describe('checker sanity', () => {
  it('counts the known 288 standard 4x4 grids from an empty board', () => {
    const r = countSolutions({ size: 4, boxRows: 2, boxCols: 2 }, new Array(16).fill(0), ['A', 'B', 'C'], 1000);
    expect(r.status === 'complete' && r.count).toBe(288);
  });

  it('caps at 2 and says so', () => {
    const r = countSolutions({ size: 6, boxRows: 2, boxCols: 3 }, new Array(36).fill(0), ['A', 'B', 'C']);
    expect(r).toMatchObject({ status: 'complete', count: 2, capped: true });
  });

  it('an exhausted budget reports "aborted", never a count', () => {
    const r = countSolutions({ size: 9, boxRows: 3, boxCols: 3 }, new Array(81).fill(0), ['A', 'B'], 2, {
      maxNodes: 10,
      maxMs: 1000,
    });
    expect(r.status).toBe('aborted');
    expect('count' in r).toBe(false);
  });

  it('a puzzle whose search cannot finish is UNVERIFIABLE, not PASS', () => {
    const p = POOL.find((q) => q.size === 9)!;
    const report = gate({ geo: geoOf(p), givens: p.givens.flat(), solution: p.solution.flat(), liar: p.falseRuleId }, {
      maxNodes: 5,
      maxMs: 1000,
    });
    expect(report.verdict).toBe('UNVERIFIABLE');
  });

  it('singles get stuck rather than guess on an empty board', () => {
    expect(logicSolve({ size: 4, boxRows: 2, boxCols: 2 }, new Array(16).fill(0), ['A', 'B', 'C']).outcome).toBe('stuck');
  });
});

/** Tutorials must stay exactly as shipped. */
const TUTORIAL_EXPECTED: Record<string, { liar: RuleId; givens: Grid; solution: Grid }> = {
  'tutorial-001': {
    liar: 'A',
    givens: [[1, 2, 0, 0], [0, 0, 3, 4], [0, 0, 0, 1], [4, 3, 4, 0]],
    solution: [[1, 2, 1, 2], [3, 4, 3, 4], [2, 1, 2, 1], [4, 3, 4, 3]],
  },
  'level-002': {
    liar: 'C',
    givens: [[0, 0, 0, 3], [2, 4, 0, 0], [1, 0, 2, 0], [0, 0, 4, 0]],
    solution: [[4, 2, 1, 3], [2, 4, 3, 1], [1, 3, 2, 4], [3, 1, 4, 2]],
  },
};

/** The 4x4 cases from before board sizes existed; they all live in Easy now. */
const LEGACY_4X4 = ['case-003', 'case-004', 'case-005', 'case-006', 'case-007', 'case-008', 'case-009', 'case-010', 'case-011'];

describe('pool', () => {
  it('keeps Level 1 then Level 2 as 4x4 tutorials, unchanged', () => {
    expect(TUTORIALS.map((p) => p.id)).toEqual(['tutorial-001', 'level-002']);
    for (const p of TUTORIALS) {
      const e = TUTORIAL_EXPECTED[p.id];
      expect([p.size, p.box, p.falseRuleId, p.givens, p.solution]).toEqual([4, { rows: 2, cols: 2 }, e.liar, e.givens, e.solution]);
    }
  });

  it('serves every live 4x4 case from Easy', () => {
    for (const id of LEGACY_4X4) expect(POOL.find((p) => p.id === id)).toMatchObject({ size: 4, tier: 'easy', status: 'live' });
  });

  it('ties board size to tier', () => {
    for (const t of TIERS) for (const p of tierPuzzles(t)) expect(p.size).toBe(TIER_SIZE[t]);
  });

  it('uses 2-high x 3-wide boxes on 6x6 and 3x3 on 9x9', () => {
    for (const p of POOL) expect(p.box).toEqual({ 4: { rows: 2, cols: 2 }, 6: { rows: 2, cols: 3 }, 9: { rows: 3, cols: 3 } }[p.size]);
  });

  it('has unique ids and case numbers', () => {
    expect(new Set(POOL.map((p) => p.id)).size).toBe(POOL.length);
    expect(new Set(POOL.map((p) => p.caseNumber)).size).toBe(POOL.length);
  });

  it('never serves tutorials or drafts from a tier', () => {
    for (const t of TIERS) for (const p of tierPuzzles(t)) expect(p.status).toBe('live');
  });

  it('has at most 3 new puzzles each in Medium and Hard', () => {
    expect(tierPuzzles('medium').length).toBeLessThanOrEqual(3);
    expect(tierPuzzles('hard').length).toBeLessThanOrEqual(3);
  });
});

describe.each(POOL.map((p) => [`${p.name} (${p.size}x${p.size})`, p] as const))('%s', (_name, p) => {
  const geo = geoOf(p);

  it('passes the fairness gate', () => {
    const r = gate({ geo, givens: p.givens.flat(), solution: p.solution.flat(), liar: p.falseRuleId }, DEFAULT_BUDGET);
    expect(r.problems).toEqual([]);
    expect(r.verdict).toBe('PASS');
  });

  it('uses digits 1..size and is size x size', () => {
    expect(p.givens).toHaveLength(p.size);
    for (const row of [...p.givens, ...p.solution]) expect(row).toHaveLength(p.size);
    expect(p.givens.flat().every((v) => v >= 0 && v <= p.size)).toBe(true);
    expect(p.solution.flat().every((v) => v >= 1 && v <= p.size)).toBe(true);
  });

  it('app engine agrees with the checker on which rules the solution obeys', () => {
    for (const id of RULE_IDS) {
      expect(ruleHolds(p.solution, id, p.size, p.box)).toBe(holds(geo, p.solution.flat(), id));
      expect(ruleHolds(p.solution, id, p.size, p.box)).toBe(id !== p.falseRuleId);
    }
  });

  it('has rule cards A, B, C naming its digit range', () => {
    expect(p.rules.map((r) => r.id)).toEqual(['A', 'B', 'C']);
    if (p.size > 4) for (const r of p.rules) expect(r.text).toContain(`1–${p.size}`);
  });

  it('win text names the liar and no other rule as lying', () => {
    const text = explain(p);
    expect(text).toContain(`Rule ${p.falseRuleId}`);
    for (const id of RULE_IDS) if (id !== p.falseRuleId) expect(text).not.toContain(`Rule ${id} lied`);
  });
});

describe('app engine geometry', () => {
  it('builds 6x6 boxes 2 high by 3 wide', () => {
    const boxes = groupsFor('C', 6, { rows: 2, cols: 3 });
    expect(boxes[0]).toEqual([[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]]);
    expect(boxes[1][0]).toEqual([0, 3]);
    expect(boxes[2][0]).toEqual([2, 0]);
  });

  it('offers digits 1..size', () => {
    expect(digitsFor(9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
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

  it('works on a 9x9 board', () => {
    const big = POOL.find((q) => q.size === 9)!;
    expect(checkSubmission(big, clone(big.solution), big.falseRuleId)).toBe('solved');
    // Change one non-given cell of the solution.
    const g = clone(big.solution);
    const c = big.givens[0].findIndex((v) => v === 0);
    g[0][c] = (g[0][c] % 9) + 1;
    expect(checkSubmission(big, g, big.falseRuleId)).toBe('wrong');
  });
});

describe('saved progress', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  });

  it('migrates v1 4x4 ids to content-bound records and leaves v1 in place', () => {
    const v1 = JSON.stringify(['tutorial-001', 'case-004', 'no-such-puzzle']);
    store.set('lying-sudoku:solved:v1', v1);
    const solved = loadSolved(POOL);
    const byId = (id: string) => POOL.find((p) => p.id === id)!;
    expect([...solved].sort()).toEqual([recordKey(byId('case-004')), recordKey(byId('tutorial-001'))].sort());
    expect(store.get('lying-sudoku:solved:v1')).toBe(v1);
    expect(JSON.parse(store.get('lying-sudoku:solved:v2')!)).toHaveLength(2);
  });

  it('a record stops matching if the puzzle content changes', () => {
    const p = POOL.find((q) => q.size === 6)!;
    const changed: Puzzle = { ...p, givens: p.givens.map((row, r) => (r === 0 ? row.map(() => 0) : row)) };
    expect(fingerprint(changed)).not.toBe(fingerprint(p));
    saveSolved(new Set([recordKey(p)]));
    expect(loadSolved(POOL).has(recordKey(changed))).toBe(false);
  });

  describe('first-visit tutorial', () => {
    const tutorialKeys = TUTORIALS.map(recordKey);
    const live = POOL.find((p) => p.status === 'live')!;

    it('opens for a brand-new device', () => {
      expect(tutorialSettled(loadSolved(POOL), tutorialKeys)).toBe(false);
    });

    it('still opens mid-tutorial (only tutorial levels solved)', () => {
      saveSolved(new Set([tutorialKeys[0]]));
      expect(tutorialSettled(loadSolved(POOL), tutorialKeys)).toBe(false);
    });

    it('stops once finished or skipped', () => {
      saveFlag(TUTORIAL_DONE_FLAG);
      expect(tutorialSettled(loadSolved(POOL), tutorialKeys)).toBe(true);
    });

    it('never opens for an existing player with progress', () => {
      saveSolved(new Set([recordKey(live)]));
      expect(tutorialSettled(loadSolved(POOL), tutorialKeys)).toBe(true);
    });

    it('never opens for an older player who dismissed the old suggestion', () => {
      store.set('lying-sudoku:tutorial-suggestion-dismissed', '1');
      expect(tutorialSettled(loadSolved(POOL), tutorialKeys)).toBe(true);
    });

    it('never opens for a v1 player (4x4 progress from before)', () => {
      store.set('lying-sudoku:solved:v1', JSON.stringify(['case-003']));
      expect(tutorialSettled(loadSolved(POOL), tutorialKeys)).toBe(true);
    });
  });

  it('round-trips v2 records', () => {
    const keys = new Set(POOL.slice(0, 3).map(recordKey));
    saveSolved(keys);
    expect(loadSolved(POOL)).toEqual(keys);
  });
});
