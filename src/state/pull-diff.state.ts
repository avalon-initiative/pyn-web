import type { DiffExpand, DiffFile, DiffLayout } from '@avalon-initiative/pyn-common-ui'
import type { ServerDiffFile, ServerDiffHunk, ServerDiffLine } from '../types/pull.types'

/** Lines one expand click loads. */
export const EXPAND_STEP = 20

export const toDiffFile = (f: ServerDiffFile): DiffFile => ({
  path: f.path,
  oldPath: f.old_path,
  status: f.status,
  additions: f.additions,
  deletions: f.deletions,
  binary: f.binary,
  tooLarge: f.too_large,
  mode: f.mode,
  lock: f.lock ?? null,
  hunks: f.hunks.map((h) => ({
    header: h.header,
    hiddenBefore: h.hidden_before,
    hiddenAfter: h.hidden_after,
    lines: h.lines.map((l) => ({ kind: l.kind, oldNo: l.old_no, newNo: l.new_no, text: l.text })),
  })),
})

// A zero-length side starts at the line before it, as in unified diff headers.
const lastNo = (h: ServerDiffHunk, side: 'old' | 'new'): number => {
  const key = side === 'old' ? 'old_no' : 'new_no'
  for (let i = h.lines.length - 1; i >= 0; i--) {
    const n = h.lines[i]![key]
    if (n != null) return n
  }
  const [start, count] = side === 'old' ? [h.old_start, h.old_lines] : [h.new_start, h.new_lines]
  return count ? start + count - 1 : start
}

// The trailing control and the last hunk's down control emit the same event; the trailing lines win.
const isTrailing = (hunks: ServerDiffHunk[], e: DiffExpand) =>
  e.direction === 'down' && e.hunk === hunks.length - 1 && hunks[e.hunk]!.hidden_after > 0

/** The new-side lines an expand loads, inclusive; null when nothing is hidden there. */
export function expandRange(
  file: ServerDiffFile,
  e: DiffExpand,
  step = EXPAND_STEP,
): { start: number; end: number } | null {
  const h = file.hunks[e.hunk]
  if (!h) return null
  if (isTrailing(file.hunks, e)) {
    const start = lastNo(h, 'new') + 1
    return { start, end: start + Math.min(step, h.hidden_after) - 1 }
  }
  const gap = h.hidden_before
  if (!gap) return null
  const prev = file.hunks[e.hunk - 1]
  const first = prev ? lastNo(prev, 'new') + 1 : 1
  const n = e.direction === 'all' ? gap : Math.min(step, gap)
  return e.direction === 'up'
    ? { start: first + gap - n, end: first + gap - 1 }
    : { start: first, end: first + n - 1 }
}

const section = (header: string) => header.replace(/^@@[^@]*@@/, '')
const withHeader = (h: ServerDiffHunk): ServerDiffHunk => ({
  ...h,
  header: `@@ -${h.old_start},${h.old_lines} +${h.new_start},${h.new_lines} @@${section(h.header)}`,
})

/** The file with `texts` (new-side lines from `start`) shown as context; a closed gap joins its hunks. */
export function applyExpand(
  file: ServerDiffFile,
  e: DiffExpand,
  start: number,
  texts: string[],
): ServerDiffFile {
  const k = texts.length
  if (!k || !file.hunks[e.hunk]) return file
  const hunks = file.hunks.map((h) => ({ ...h, lines: [...h.lines] }))
  const h = hunks[e.hunk]!
  const context = (delta: number): ServerDiffLine[] =>
    texts.map((text, j) => ({
      kind: 'context',
      old_no: start + j + delta,
      new_no: start + j,
      text,
    }))
  if (isTrailing(hunks, e)) {
    h.lines.push(...context(lastNo(h, 'old') - lastNo(h, 'new')))
    h.old_lines += k
    h.new_lines += k
    h.hidden_after = Math.max(0, h.hidden_after - k)
    hunks[e.hunk] = withHeader(h)
    return { ...file, hunks }
  }
  const prev = hunks[e.hunk - 1]
  const delta = prev ? lastNo(prev, 'old') - lastNo(prev, 'new') : 0
  if (prev && start === lastNo(prev, 'new') + 1) {
    prev.lines.push(...context(delta))
    prev.old_lines += k
    prev.new_lines += k
  } else {
    h.lines.unshift(...context(delta))
    h.old_start = start + delta
    h.new_start = start
    h.old_lines += k
    h.new_lines += k
  }
  h.hidden_before = Math.max(0, h.hidden_before - k)
  if (prev && h.hidden_before === 0) {
    prev.lines.push(...h.lines)
    prev.old_lines += h.old_lines
    prev.new_lines += h.new_lines
    prev.hidden_after = h.hidden_after
    hunks.splice(e.hunk, 1)
  }
  return { ...file, hunks: hunks.map(withHeader) }
}

// Viewed marks remember each file's blob, so a file that changes again shows as not viewed.
const VIEWED_KEY = 'pyn.pull-viewed.'
const LAYOUT_KEY = 'pyn.diff-layout'
type ViewedMarks = Record<string, string>

const blobOf = (f: ServerDiffFile) => f.new_content ?? f.old_content ?? ''

export function readViewed(key: string): ViewedMarks {
  try {
    const marks: unknown = JSON.parse(localStorage.getItem(VIEWED_KEY + key) ?? '{}')
    return marks && typeof marks === 'object' && !Array.isArray(marks) ? (marks as ViewedMarks) : {}
  } catch {
    return {}
  }
}

/** The paths whose mark still matches the file. */
export const viewedPaths = (marks: ViewedMarks, files: ServerDiffFile[]): string[] =>
  files.filter((f) => f.path in marks && marks[f.path] === blobOf(f)).map((f) => f.path)

/** Stores the marks for `paths`, keeping only the files of this diff. */
export function writeViewed(key: string, paths: string[], files: ServerDiffFile[]): void {
  const marks = Object.fromEntries(
    files.filter((f) => paths.includes(f.path)).map((f) => [f.path, blobOf(f)]),
  )
  try {
    if (Object.keys(marks).length) localStorage.setItem(VIEWED_KEY + key, JSON.stringify(marks))
    else localStorage.removeItem(VIEWED_KEY + key)
  } catch {
    // storage unavailable: the marks last for this page load
  }
}

export function readLayout(): DiffLayout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'split' ? 'split' : 'unified'
  } catch {
    return 'unified'
  }
}

export function writeLayout(layout: DiffLayout): void {
  try {
    localStorage.setItem(LAYOUT_KEY, layout)
  } catch {
    // storage unavailable
  }
}
