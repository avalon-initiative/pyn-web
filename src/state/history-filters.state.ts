import type { PynHistory } from '@avalon-initiative/pyn-common-ui'

export type HistoryRange = NonNullable<InstanceType<typeof PynHistory>['$props']['range']>

const ranges: HistoryRange[] = ['all', 'day', 'week', 'month', 'year']

export const asRange = (v: unknown): HistoryRange =>
  ranges.includes(v as HistoryRange) ? (v as HistoryRange) : 'all'

/** The RFC 3339 start of a "last ..." range, undefined for all time. */
export function rangeSince(range: HistoryRange, now = new Date()): string | undefined {
  if (range === 'all') return undefined
  const d = new Date(now)
  if (range === 'day') d.setDate(d.getDate() - 1)
  else if (range === 'week') d.setDate(d.getDate() - 7)
  else if (range === 'month') d.setMonth(d.getMonth() - 1)
  else d.setFullYear(d.getFullYear() - 1)
  return d.toISOString()
}

/** Route query of the author and range filters; the defaults are left out. */
export const filterQuery = (author: string, range: HistoryRange): Record<string, string> => ({
  ...(author ? { author } : {}),
  ...(range !== 'all' ? { range } : {}),
})

/** The author list for the filter, keeping a chosen author the list lacks. */
export const authorOptions = (authors: string[], chosen: string) =>
  chosen && !authors.includes(chosen) ? [chosen, ...authors] : authors
