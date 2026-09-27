/**
 * Undo/redo for the editor's motion state. Changes with the same
 * `coalesceKey` within `coalesceMs` merge into one step, so dragging a
 * slider undoes in one go instead of one pixel at a time.
 */
export type History<T> = {
  past: T[]
  present: T
  future: T[]
  lastKey: string | null
  lastAt: number
}

const limit = 100
const coalesceMs = 800

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastAt: 0 }
}

export function commit<T>(
  history: History<T>,
  next: T,
  options: { coalesceKey?: string; now?: number } = {}
): History<T> {
  const now = options.now ?? Date.now()
  const key = options.coalesceKey ?? null
  const merges =
    key !== null && key === history.lastKey && now - history.lastAt < coalesceMs
  return {
    past: merges
      ? history.past
      : [...history.past, history.present].slice(-limit),
    present: next,
    future: [],
    lastKey: key,
    lastAt: now,
  }
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1)
  if (previous === undefined) return history
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    lastKey: null,
    lastAt: 0,
  }
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future
  if (next === undefined) return history
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
    lastKey: null,
    lastAt: 0,
  }
}
