import { ApiError } from '../api/client'
import type { BlockedStatus } from '../types/auth.types'

const BLOCKED: Record<string, BlockedStatus> = {
  email_not_verified: 'pending_verification',
  approval_pending: 'pending_approval',
  account_disabled: 'account_disabled',
}

/** The state a refused sign-in puts the account in, or null for any other failure. */
export function blockedStatus(e: unknown): BlockedStatus | null {
  return e instanceof ApiError && e.status === 403 ? (BLOCKED[e.code] ?? null) : null
}
