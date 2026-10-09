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

export const NOTICE_TITLES: Record<BlockedStatus, string> = {
  pending_verification: 'Check your email',
  pending_approval: 'Waiting for approval',
  account_disabled: 'Account disabled',
}

export const NOTICE_TEXT: Record<BlockedStatus, string> = {
  pending_verification:
    'Follow the link in the verification email to activate the account. The link works once and expires after 24 hours.',
  pending_approval:
    'An administrator of this server must approve the account before it can sign in.',
  account_disabled:
    'An administrator disabled this account. Contact them to have it enabled again.',
}
