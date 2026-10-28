# Sudoku, but the Rules Are Lying

Local prototype (React + TypeScript + Vite). A verified pool of cases with an Easy / Medium / Hard selector above the grid (Easy 4×4 with 2×2 boxes, Medium 6×6 with boxes 2 high × 3 wide, Hard 9×9 with 3×3 boxes), plus an optional two-level 4×4 tutorial.

Contract: digits 1–4 only, givens never change, exactly one of the three rule
cards is false and simply isn't enforced; the other two apply.

```bash
npm install
npm test        # solver + contract tests
npm run verify  # fairness gate for every pool puzzle (capped, budgeted solver + singles-only deducibility)
npm run verify -- --walkthroughs docs/WALKTHROUGHS.md   # also regenerate the Medium/Hard walkthroughs
npm run search -- 9 30 subtle 54   # authoring aid: candidate puzzles for a size (must pass verify to ship)
npm run dev     # http://localhost:5173
```

- `src/game/pool.ts`: the puzzle pool (id, name, givens, liar, solution, tier, status). Tier labels are drafts.
- `src/game/progress.ts`: solved puzzles in localStorage, keyed by id + content fingerprint (v1 ids migrated once, v1 key kept)
- `scripts/lib/checker.ts`: the verify gate's solver and singles logic, independent of `src/game`
- `docs/WALKTHROUGHS.md`: deduction walkthroughs for every Medium and Hard case
- `src/game/explain.ts`: win-screen text (generated from the solution unless a puzzle has its own)
- `src/game/solver.ts`: brute-force enumerating solver
- `src/game/check.ts`: submission check (deliberately vague on failure)
- `src/App.tsx`, `src/styles.css`: UI
