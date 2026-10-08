import type { FileRow } from '../types/lock.types'

export function splitPath(path: string): { dir: string; name: string } {
  const i = path.lastIndexOf('/')
  return i < 0 ? { dir: '', name: path } : { dir: path.slice(0, i + 1), name: path.slice(i + 1) }
}

/** Groups rows by their first path segment; files at the root go under "(root)". */
export function groupByTopLevel(rows: FileRow[]): { name: string; rows: FileRow[] }[] {
  const groups = new Map<string, FileRow[]>()
  for (const row of rows) {
    const i = row.path.indexOf('/')
    const key = i < 0 ? '(root)' : row.path.slice(0, i)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return [...groups].map(([name, rows]) => ({ name, rows }))
}
