import { ApiError, describeError } from '../api/client'

const PARALLEL = 4

/** Releases the locks a few at a time and returns the failures in order; a 401 aborts the whole run. */
export async function releaseEach<T>(
  locks: T[],
  release: (lock: T) => Promise<void>,
): Promise<{ lock: T; message: string }[]> {
  const failed = new Map<number, string>()
  let next = 0
  let expired: ApiError | undefined
  const worker = async () => {
    while (!expired && next < locks.length) {
      const i = next++
      try {
        await release(locks[i])
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) expired = e
        else failed.set(i, describeError(e))
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, locks.length) }, worker))
  if (expired) throw expired
  return [...failed].sort(([a], [b]) => a - b).map(([i, message]) => ({ lock: locks[i], message }))
}
