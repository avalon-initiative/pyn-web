const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parts(iso: string, timeZone?: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const p: Record<string, string> = Object.fromEntries(
    fmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  )
  return { ...p, month: MONTHS[Number(p.month) - 1] }
}

/** "Jun 09 2026" in the browser's timezone (or `timeZone`). */
export function formatDate(iso: string, timeZone?: string): string {
  const p = parts(iso, timeZone)
  return `${p.month} ${p.day} ${p.year}`
}

/** "Jun 09 2026 14:05", 24-hour clock. */
export function formatDateTime(iso: string, timeZone?: string): string {
  const p = parts(iso, timeZone)
  return `${p.month} ${p.day} ${p.year} ${p.hour}:${p.minute}`
}
