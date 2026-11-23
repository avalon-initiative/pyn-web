import { computed, ref } from 'vue'
import { formatDate } from '@avalon-initiative/pyn-common-ui'
import type { TwoFactorStatus } from '../types/two-factor.types'
import { fetchTwoFactor } from '../api/two-factor'
import { SECURITY_PATH, twoFactorDue } from './two-factor.state'

const DISMISSED_KEY = 'pyn.security-notice.dismissed'

/** Whether the account has a second factor; null until known or when the status call failed. */
const enabled = ref<boolean | null>(null)

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}
const dismissed = ref(false)

/** Takes the status the security pages just read or changed. */
export function applySecurityStatus(status: Pick<TwoFactorStatus, 'enabled'>) {
  enabled.value = status.enabled
}

/** Reads the status once per sign-in; a failure leaves the notice hidden. */
export async function loadSecurityNotice() {
  dismissed.value = readDismissed()
  try {
    applySecurityStatus(await fetchTwoFactor())
  } catch {
    enabled.value = null
  }
}

export function resetSecurityNotice() {
  enabled.value = null
  dismissed.value = false
  try {
    sessionStorage.removeItem(DISMISSED_KEY)
  } catch {
    // storage unavailable: the dismissal only lasts for this page load
  }
}

export function dismissSecurityNotice() {
  dismissed.value = true
  try {
    sessionStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // storage unavailable: the dismissal only lasts for this page load
  }
}

/** Props for the library's security notice, or null when nothing should be shown. */
export const securityNotice = computed(() => {
  const due = twoFactorDue.value
  if (enabled.value === true || (enabled.value === null && !due)) return null
  if (due) {
    const who =
      due.by === 'organization' && due.organization
        ? `The organization ${due.organization}`
        : 'This server'
    return {
      required: true,
      dismissible: false,
      message: due.enforced
        ? `${who} requires two-factor authentication. Set up a second factor to keep using your account.`
        : `${who} requires two-factor authentication. Set up a second factor before the deadline.`,
      deadline: due.enforced ? undefined : `Required from ${formatDate(due.deadline)}`,
      actionLabel: 'Set up two-factor authentication',
      actionHref: SECURITY_PATH,
    }
  }
  if (dismissed.value) return null
  return {
    required: false,
    dismissible: true,
    message: 'Protect your account: add two-factor authentication.',
    deadline: undefined,
    actionLabel: 'Set up two-factor authentication',
    actionHref: SECURITY_PATH,
  }
})
