# Sudoku, but the Rules Are Lying

Local prototype (React + TypeScript + Vite). Two handcrafted 4×4 levels (tutorial + Level 2).

Contract: digits 1–4 only, givens never change, exactly one of the three rule
cards is false and simply isn't enforced; the other two apply.

```bash
npm install
npm test        # solver + contract tests
npm run verify  # brute-force check of every level (counts per possible liar)
npm run dev     # http://localhost:5173
```

- `src/game/types.ts` / `puzzles.ts`: levels as data, played in order (givens, rule cards, false card id, solution, explanation)
- `src/game/solver.ts`: brute-force enumerating solver
- `src/game/check.ts`: submission check (deliberately vague on failure)
- `src/App.tsx`, `src/styles.css`: UI
