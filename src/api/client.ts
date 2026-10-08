import { authHeaders } from '../state/credential.state'
import type { FilePage, FileRow, Me } from '../types/lock.types'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

async function get<T>(path: string, credential: string): Promise<T> {
  const res = await fetch(path, { headers: authHeaders(credential) })
  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ code: 'error', message: `server returned ${res.status}` }))
    throw new ApiError(res.status, body.code, body.message)
  }
  return res.json()
}

export function fetchMe(credential: string): Promise<Me> {
  return get('/v1/me', credential)
}

export async function fetchFiles(credential: string): Promise<FileRow[]> {
  const rows: FileRow[] = []
  let after: string | null = null
  do {
    const path: string = after ? `/v1/files?after=${encodeURIComponent(after)}` : '/v1/files'
    const page: FilePage = await get(path, credential)
    rows.push(...page.entries)
    after = page.next_after
  } while (after)
  return rows
}
