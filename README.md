# Sudoku, but the Rules Are Lying

Local prototype (React + TypeScript + Vite). One handcrafted 4×4 tutorial case.

Contract: digits 1–4 only, givens never change, exactly one of the three rule
cards is false and simply isn't enforced; the other two apply.

```bash
npm install
npm test        # solver + contract tests
npm run report  # prints solution counts per possible false card
npm run dev     # http://localhost:5173
```

- `src/game/types.ts` / `puzzles.ts`: puzzles as data (givens, rule cards, false card id, solution, explanation)
- `src/game/solver.ts`: brute-force enumerating solver
- `src/game/check.ts`: submission check (deliberately vague on failure)
- `src/App.tsx`, `src/styles.css`: UI
