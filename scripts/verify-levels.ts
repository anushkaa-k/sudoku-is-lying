/**
 * Independent brute-force check of every level. It does not use the app's solver:
 * it tries every 1-4 fill of the empty cells and counts the grids that satisfy
 * the two rules left over when each candidate liar is ignored.
 *
 * Run: npm run verify   (exits non-zero if any level fails)
 */
import { LEVELS } from '../src/game/puzzles';
import type { Grid, RuleId } from '../src/game/types';

const RULES: RuleId[] = ['A', 'B', 'C'];

function cellsOf(rule: RuleId, i: number): [number, number][] {
  return [0, 1, 2, 3].map((j): [number, number] =>
    rule === 'A' ? [i, j] : rule === 'B' ? [j, i] : [2 * Math.floor(i / 2) + Math.floor(j / 2), 2 * (i % 2) + (j % 2)],
  );
}

function holds(g: number[][], rule: RuleId): boolean {
  for (let i = 0; i < 4; i++) {
    const vals = cellsOf(rule, i).map(([r, c]) => g[r][c]);
    if (new Set(vals).size !== 4 || vals.some((v) => v < 1 || v > 4)) return false;
  }
  return true;
}

function count(givens: Grid, liar: RuleId): number {
  const enforced = RULES.filter((r) => r !== liar);
  const empties: [number, number][] = [];
  givens.forEach((row, r) => row.forEach((v, c) => v === 0 && empties.push([r, c])));
  const g = givens.map((row) => [...row]) as number[][];
  let n = 0;
  for (let k = 0; k < 4 ** empties.length; k++) {
    let x = k;
    for (const [r, c] of empties) {
      g[r][c] = (x % 4) + 1;
      x = Math.floor(x / 4);
    }
    if (enforced.every((rule) => holds(g, rule))) n++;
  }
  return n;
}

let ok = true;
LEVELS.forEach((p, i) => {
  console.log(`Level ${i + 1} (${p.label}), stored liar: Rule ${p.falseRuleId}`);
  const counts = RULES.map((liar) => count(p.givens, liar));
  RULES.forEach((liar, j) => console.log(`  if ${liar} lies: ${counts[j]} grid(s)`));
  const viable = RULES.filter((_, j) => counts[j] > 0);
  const uniqueLiar = viable.length === 1 && viable[0] === p.falseRuleId && counts[RULES.indexOf(p.falseRuleId)] === 1;
  const solOk = RULES.every((r) => holds(p.solution, r) === (r !== p.falseRuleId));
  const givensKept = p.givens.every((row, r) => row.every((v, c) => v === 0 || v === p.solution[r][c]));
  console.log(`  only Rule ${p.falseRuleId} has solutions, exactly 1: ${uniqueLiar ? 'PASS' : 'FAIL'}`);
  console.log(`  stored solution breaks ${p.falseRuleId}, keeps the other two: ${solOk ? 'PASS' : 'FAIL'}`);
  console.log(`  stored solution keeps every given: ${givensKept ? 'PASS' : 'FAIL'}`);
  ok &&= uniqueLiar && solOk && givensKept;
});
console.log(ok ? '\nAll levels verified.' : '\nVERIFICATION FAILED');
process.exit(ok ? 0 : 1);
