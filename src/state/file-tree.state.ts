/** Folders along a path from the root, e.g. "a/b/c.ts" gives ["a", "a/b"]. */
export function ancestorFolders(path: string): string[] {
  const parts = path.split('/').filter(Boolean)
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'))
}

/** The open folders after a toggle. */
export function toggled(expanded: string[], folder: string): string[] {
  return expanded.includes(folder) ? expanded.filter((f) => f !== folder) : [...expanded, folder]
}
