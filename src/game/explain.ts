import { groupsFor, RULE_IDS } from './solver';
import type { Puzzle, RuleId } from './types';

const GROUP_NAME: Record<RuleId, (i: number) => string> = {
  A: (i) => `row ${i + 1}`,
  B: (i) => `column ${i + 1}`,
  C: (i) => `the ${['top-left', 'top-right', 'bottom-left', 'bottom-right'][i]} box`,
};
const PLURAL: Record<RuleId, string> = { A: 'Rows', B: 'Columns', C: 'Boxes' };

/**
 * The win-screen text: names the liar and points at a real repeat in the solution.
 * Only shown after a correct solve, so it never leaks anything early.
 */
export function explain(p: Puzzle): string {
  if (p.explanation) return p.explanation;
  const liar = p.falseRuleId;
  const [a, b] = RULE_IDS.filter((r) => r !== liar);
  const groups = groupsFor(liar);
  const i = groups.findIndex((g) => new Set(g.map(([r, c]) => p.solution[r][c])).size < 4);
  const digits = groups[i].map(([r, c]) => p.solution[r][c]).join(', ');
  const givenRepeat = groups.some((g) => {
    const vals = g.map(([r, c]) => p.givens[r][c]).filter((v) => v !== 0);
    return new Set(vals).size !== vals.length;
  });
  const how = givenRepeat
    ? 'The fixed tiles were already repeating a digit, which is about as subtle as the rulebook gets.'
    : `No fixed tile gave it away. Trust Rule ${liar} and the grid has no answer at all.`;
  return `Rule ${liar} lied. ${PLURAL[a]} and ${PLURAL[b].toLowerCase()} hold, but ${GROUP_NAME[liar](i)} reads ${digits}. ${how}`;
}
