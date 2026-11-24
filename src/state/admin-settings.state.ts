import { formatAgo } from '@avalon-initiative/pyn-common-ui'
import type { AccountInfo } from '@avalon-initiative/pyn-common-ui'
import type { AdminSettings } from '../types/admin.types'

/** One line on automatic deletion of disabled accounts. */
export function retentionNote(s: AdminSettings): string {
  const { disabled_retention_days: days, window_days: window } = s.account_deletion
  const auto =
    days > 0
      ? `Disabled accounts are deleted automatically after ${days} days.`
      : 'Automatic deletion of disabled accounts is off.'
  return `${auto} A deletion can be undone for ${window} days.`
}

/** The library shows the resend action from a flag; the server reports the status. */
export const markPending = (accounts: AccountInfo[]): AccountInfo[] =>
  accounts.map((a) => ({ ...a, pending_verification: a.status === 'pending_verification' }))

/** The mailer's last check, failure and delivery as settings rows. */
export function emailFacts(
  e: AdminSettings['email'],
  now: Date,
): { title: string; value: string }[] {
  const ago = (at: string) => formatAgo(at, now)
  const check = e.last_check
  return [
    {
      title: 'Connection check',
      value: !check
        ? 'Not checked yet'
        : check.error
          ? `Failed ${ago(check.at)}: ${check.error}`
          : `Passed ${ago(check.at)}`,
    },
    {
      title: 'Last failure',
      value: e.last_failure
        ? `${ago(e.last_failure.at)}: ${e.last_failure.error}`
        : 'None since the server started',
    },
    {
      title: 'Last sent',
      value: e.last_sent_at ? ago(e.last_sent_at) : 'Nothing sent since the server started',
    },
  ]
}
