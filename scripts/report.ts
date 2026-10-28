import { PUZZLES } from '../src/game/puzzles';
import { countIfFalse, ruleHolds, solveAll, RULE_IDS } from '../src/game/solver';

for (const p of PUZZLES) {
  console.log(`Case #${p.caseNumber} (${p.id})`);
  for (const id of RULE_IDS) {
    console.log(`  if ${id} is false: ${countIfFalse(p.givens, id).length} completion(s)`);
  }
  console.log(`  standard Sudoku:  ${solveAll(p.givens, RULE_IDS).length} completion(s)`);
  const [only] = countIfFalse(p.givens, p.falseRuleId);
  console.log(`  unique completion violates ${p.falseRuleId}: ${!ruleHolds(only, p.falseRuleId)}`);
  console.log(only.map((r) => '  ' + r.join(' ')).join('\n'));
}
