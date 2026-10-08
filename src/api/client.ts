import type { LockInfo } from '../types/lock.types'

export async function fetchLocks(): Promise<LockInfo[]> {
  const res = await fetch('/v1/locks')
  if (!res.ok) throw new Error(`pyn-server returned ${res.status}`)
  return res.json()
}
