import type { FilePage, FileRow } from '../types/lock.types'

export async function fetchFiles(): Promise<FileRow[]> {
  const rows: FileRow[] = []
  let after: string | null = null
  do {
    const res: Response = await fetch(
      after ? `/v1/files?after=${encodeURIComponent(after)}` : '/v1/files',
    )
    if (!res.ok) throw new Error(`pyn-server returned ${res.status}`)
    const page: FilePage = await res.json()
    rows.push(...page.entries)
    after = page.next_after
  } while (after)
  return rows
}
