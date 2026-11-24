/** The open folders after a toggle. */
export function toggled(expanded: string[], folder: string): string[] {
  return expanded.includes(folder) ? expanded.filter((f) => f !== folder) : [...expanded, folder]
}
