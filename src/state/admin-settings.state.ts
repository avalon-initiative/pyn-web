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
