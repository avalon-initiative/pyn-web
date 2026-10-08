import type { LockInfo } from '../types/lock.types'

// Hand-written for the proof of concept. Replace with the client generated from pyn-server's
// /openapi.json once that generation step exists (see NEXT_TASKS).

export async function fetchLocks(): Promise<LockInfo[]> {
  const res = await fetch('/v1/locks')
  if (!res.ok) throw new Error(`pyn-server returned ${res.status}`)
  return res.json()
}
