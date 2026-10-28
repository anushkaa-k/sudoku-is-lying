/**
 * Independent brute-force check of every puzzle in the pool. It does not use the
 * app's solver: it tries every 1-4 fill of the empty cells and counts the grids
 * that satisfy the two rules left over when each candidate liar is ignored.
 *
 * A puzzle passes only if exactly one liar gives exactly one grid, the other two
 * give none, and that liar and grid match what the pool stores.
 *
 * Run: npm run verify   (exits non-zero if any non-draft puzzle fails)
 */
import { POOL } from '../src/game/pool';
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

/** Every grid matching the givens that satisfies the two rules other than `liar`. */
function completions(givens: Grid, liar: RuleId): number[][][] {
  const enforced = RULES.filter((r) => r !== liar);
  const empties: [number, number][] = [];
  givens.forEach((row, r) => row.forEach((v, c) => v === 0 && empties.push([r, c])));
  const g = givens.map((row) => [...row]) as number[][];
  const found: number[][][] = [];
  for (let k = 0; k < 4 ** empties.length; k++) {
    let x = k;
    for (const [r, c] of empties) {
      g[r][c] = (x % 4) + 1;
      x = Math.floor(x / 4);
    }
    if (enforced.every((rule) => holds(g, rule))) found.push(g.map((row) => [...row]));
  }
  return found;
}

const same = (a: number[][], b: number[][]) => a.every((row, r) => row.every((v, c) => v === b[r][c]));
const mark = (b: boolean) => (b ? 'PASS' : 'FAIL');

let ok = true;
let passed = 0;
const ids = new Set<string>();
for (const p of POOL) {
  console.log(`${p.id}  "${p.name}"  tier: ${p.tier}  status: ${p.status}  stored liar: Rule ${p.falseRuleId}`);
  const found = RULES.map((liar) => completions(p.givens, liar));
  console.log('  ' + RULES.map((liar, j) => `if ${liar} lies: ${found[j].length}`).join('   '));
  const viable = RULES.filter((_, j) => found[j].length > 0);
  const liarIdx = RULES.indexOf(p.falseRuleId);
  const checks: [string, boolean][] = [
    ['exactly one liar has solutions, exactly 1', viable.length === 1 && found[RULES.indexOf(viable[0])].length === 1],
    [`that liar is the stored one (Rule ${p.falseRuleId})`, viable.length === 1 && viable[0] === p.falseRuleId],
    ['the one grid is the stored solution', found[liarIdx].length === 1 && same(found[liarIdx][0], p.solution)],
    [`stored solution breaks ${p.falseRuleId}, keeps the other two`, RULES.every((r) => holds(p.solution, r) === (r !== p.falseRuleId))],
    ['stored solution keeps every given', p.givens.every((row, r) => row.every((v, c) => v === 0 || v === p.solution[r][c]))],
    ['unique id', !ids.has(p.id)],
  ];
  ids.add(p.id);
  for (const [label, pass] of checks) console.log(`  ${mark(pass)}  ${label}`);
  const pass = checks.every(([, b]) => b);
  if (pass) passed++;
  else if (p.status === 'draft') console.log('  (draft: not shipped)');
  else ok = false;
}
console.log(`\n${passed}/${POOL.length} puzzles pass.`);
console.log(ok ? 'All shipped puzzles verified.' : 'VERIFICATION FAILED: a shipped puzzle does not pass.');
process.exit(ok ? 0 : 1);
