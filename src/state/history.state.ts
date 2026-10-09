export const FILTER_DEBOUNCE_MS = 300

/** Route query for the history tab; path and filter are mutually exclusive. */
export function historyQuery(path: string, filter: string): Record<string, string> {
  if (path) return { path }
  return filter ? { filter } : {}
}
