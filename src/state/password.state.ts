import { ApiError, describeError } from '../api/client'

export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 256

export const PASSWORD_RULES = [
  `At least ${PASSWORD_MIN_LENGTH} characters, at most ${PASSWORD_MAX_LENGTH}.`,
]

export const PASSWORD_CHANGED =
  'Password changed. Your other web sessions and the tokens made by pyn login are signed out; this session stays signed in. Tokens you created and SSH keys keep working.'

/** The text for a failed change. A 401 here is the wrong current password, not an ended session. */
export function passwordError(e: unknown): string {
  if (e instanceof ApiError && e.status === 401) return 'The current password is wrong.'
  return describeError(e)
}
