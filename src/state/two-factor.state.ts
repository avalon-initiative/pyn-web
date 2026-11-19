import { ref } from 'vue'
import { ApiError } from '../api/client'
import type { TwoFactorRequired } from '../types/two-factor.types'

export const ENROLMENT_REQUIRED = 'two_factor_enrolment_required'
export const SECOND_FACTOR_REQUIRED = 'second_factor_required'
export const SECURITY_PATH = '/_/settings/security'

/** The requirement the account has not met yet; drives the nag and clears once a factor is on. */
export const twoFactorDue = ref<TwoFactorRequired | null>(null)

let listener: (() => void) | null = null

/** Registers the one reaction to the server holding the account to enrolment. */
export function onEnrolmentRequired(fn: (() => void) | null) {
  listener = fn
}

export function reportEnrolmentRequired(code: string) {
  if (code === ENROLMENT_REQUIRED) listener?.()
}

export const needsSecondFactor = (e: unknown) =>
  e instanceof ApiError && e.status === 401 && e.code === SECOND_FACTOR_REQUIRED

export function nagText(due: TwoFactorRequired): string {
  const who = due.by === 'organization' ? `The organization ${due.organization}` : 'This server'
  const when = new Date(due.deadline).toISOString().slice(0, 10)
  return due.enforced
    ? `${who} requires two-factor authentication. Set up a second factor to keep using your account.`
    : `${who} requires two-factor authentication from ${when}. Set up a second factor before then.`
}

const NOTICE_TEXT: Record<string, string> = {
  two_factor_reset: 'An administrator reset your second factors. Set them up again.',
  passkey_clone_suspected:
    'A passkey was used with a signature counter that went backwards, which can mean it was copied. Remove it and register a new one.',
}

export const noticeText = (kind: string, detail: string) => NOTICE_TEXT[kind] ?? detail
