/** Which puzzles this browser has solved, plus small flags. Stored locally only; the game works without it. */
const KEY = 'lying-sudoku:solved:v1';

export function loadSolved(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveSolved(solved: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...solved]));
  } catch {
    // Private mode or blocked storage: progress just won't survive a refresh.
  }
}

/** One-off yes/no flags, e.g. "the tutorial suggestion was dismissed". */
export function loadFlag(name: string): boolean {
  try {
    return localStorage.getItem(`lying-sudoku:${name}`) === '1';
  } catch {
    return false;
  }
}

export function saveFlag(name: string): void {
  try {
    localStorage.setItem(`lying-sudoku:${name}`, '1');
  } catch {
    // Storage blocked: the flag just won't survive a refresh.
  }
}
