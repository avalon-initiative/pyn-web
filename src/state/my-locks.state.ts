import { ApiError, describeError } from '../api/client'
import type { MyLock, ReleaseFailure } from '../types/lock.types'

export const myLockKey = (l: MyLock) => `${l.owner}/${l.name}:${l.path}`

/** Releases each lock in turn and returns the failures; a 401 aborts the whole run. */
export async function releaseEach(
  locks: MyLock[],
  release: (lock: MyLock) => Promise<void>,
): Promise<ReleaseFailure[]> {
  const failures: ReleaseFailure[] = []
  for (const lock of locks) {
    try {
      await release(lock)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) throw e
      failures.push({ lock, message: describeError(e) })
    }
  }
  return failures
}
