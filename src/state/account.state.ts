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

const SIGN_IN_ERRORS: Record<string, string> = {
  external_sign_in_failed: 'Sign-in with the provider did not complete. Try again.',
  external_account_not_linked:
    'No account is linked to that identity. Sign in with your password and link it, or ask an administrator.',
  external_identity_taken: 'That identity is already linked to another account.',
  external_provider_unavailable: 'The sign-in provider is not reachable right now.',
  account_disabled: 'An administrator disabled this account.',
  approval_pending: 'An administrator must approve this account before it can sign in.',
  email_not_verified: 'Verify your email address before signing in.',
  too_many_attempts: 'Too many attempts. Try again later.',
}

/** Text for the `error` code the server puts on the sign-in page after a provider round trip. */
export const signInErrorMessage = (code: string) =>
  SIGN_IN_ERRORS[code] ?? 'Sign-in with the provider failed.'

/** The provider's start URL, asking to come back to `returnTo` (an app path). */
export function externalSignInUrl(signInUrl: string, returnTo = '/'): string {
  const join = signInUrl.includes('?') ? '&' : '?'
  return `${signInUrl}${join}return_to=${encodeURIComponent(returnTo)}`
}
