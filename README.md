# Sudoku, but the Rules Are Lying

Local prototype (React + TypeScript + Vite). A pool of 4×4 cases: two tutorial levels, then Easy / Medium / Hard picks.

Contract: digits 1–4 only, givens never change, exactly one of the three rule
cards is false and simply isn't enforced; the other two apply.

```bash
npm install
npm test        # solver + contract tests
npm run verify  # brute-force check of every pool puzzle (counts per possible liar)
npm run search  # authoring aid: prints candidate puzzles (must pass verify to ship)
npm run dev     # http://localhost:5173
```

- `src/game/pool.ts`: the puzzle pool (id, name, givens, liar, solution, tier, status). Tier labels are drafts.
- `src/game/progress.ts`: solved puzzle ids in localStorage
- `src/game/explain.ts`: win-screen text (generated from the solution unless a puzzle has its own)
- `src/game/solver.ts`: brute-force enumerating solver
- `src/game/check.ts`: submission check (deliberately vague on failure)
- `src/App.tsx`, `src/styles.css`: UI
