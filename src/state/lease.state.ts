import type { LockInfo, LockState } from '../types/lock.types'

/** A lease with less than this left is shown as expiring. */
export const EXPIRING_SOON_MS = 30 * 60 * 1000

/** "3h 42m", "12m", "<1m", or "expired". */
export function formatLease(expiresAt: string, now: Date): string {
  const ms = new Date(expiresAt).getTime() - now.getTime()
  if (ms <= 0) return 'expired'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return '<1m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** What a viewer should see for a file's lock. An expired lock counts as no lock. */
export function lockState(
  lock: LockInfo | null | undefined,
  me: string | undefined,
  now: Date,
): LockState {
  if (!lock) return 'available'
  const left = new Date(lock.expires_at).getTime() - now.getTime()
  if (left <= 0) return 'available'
  if (lock.owner === me) return 'mine'
  return left < EXPIRING_SOON_MS ? 'expiring' : 'locked'
}
