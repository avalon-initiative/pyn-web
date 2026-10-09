import type { LineRange } from '../types/code.types'

/** The line range a `#L12` or `#L12-L20` hash names, ordered; null for anything else. */
export function parseLineHash(hash: string): LineRange | null {
  const m = /^#L(\d+)(?:-L?(\d+))?$/.exec(hash)
  if (!m) return null
  const a = Number(m[1])
  const b = m[2] === undefined ? a : Number(m[2])
  if (a < 1 || b < 1) return null
  return { start: Math.min(a, b), end: Math.max(a, b) }
}

export const lineHash = (r: LineRange): string =>
  r.start === r.end ? `#L${r.start}` : `#L${r.start}-L${r.end}`

/** The range after clicking a line; shift extends from the current range's first line. */
export function clickLine(current: LineRange | null, line: number, shift: boolean): LineRange {
  if (!shift || !current) return { start: line, end: line }
  return { start: Math.min(current.start, line), end: Math.max(current.start, line) }
}

export const inRange = (r: LineRange | null | undefined, line: number): boolean =>
  !!r && line >= r.start && line <= r.end
