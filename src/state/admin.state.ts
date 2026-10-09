import { formatDateTime } from './datetime.state'
import type { AccountInfo, AdminAccountStatus } from '../types/admin.types'

export const STATUS_FILTERS: { id: AdminAccountStatus | ''; label: string }[] = [
  { id: '', label: 'All accounts' },
  { id: 'pending_approval', label: 'Waiting for approval' },
  { id: 'pending_verification', label: 'Waiting for email verification' },
  { id: 'active', label: 'Active' },
  { id: 'disabled', label: 'Disabled' },
]

const LABELS: Record<AdminAccountStatus, string> = {
  pending_verification: 'Unverified',
  pending_approval: 'Needs approval',
  active: 'Active',
  disabled: 'Disabled',
}

export const statusLabel = (status: AdminAccountStatus) => LABELS[status] ?? status

export type AccountAction = 'approve' | 'disable' | 'enable'

/** The actions the server accepts for this account; an admin cannot disable themselves. */
export function accountActions(account: AccountInfo, self: string): AccountAction[] {
  if (account.status === 'disabled') return ['enable']
  const actions: AccountAction[] = account.status === 'pending_approval' ? ['approve'] : []
  if (account.user !== self) actions.push('disable')
  return actions
}

/** Replaces an account in the list after an action, or drops it when the filter no longer matches. */
export function applyUpdate(
  accounts: AccountInfo[],
  updated: AccountInfo,
  filter: AdminAccountStatus | '',
): AccountInfo[] {
  const next = accounts.map((a) => (a.user === updated.user ? updated : a))
  return filter ? next.filter((a) => a.status === filter) : next
}

/** "Disabled Oct 05 2026 14:00: reason", leaving out what the server did not record. */
export function disabledNote(account: AccountInfo): string {
  const when = account.disabled_at ? ` ${formatDateTime(account.disabled_at)}` : ''
  const why = account.disabled_reason ? `: ${account.disabled_reason}` : ''
  return `Disabled${when}${why}`
}
