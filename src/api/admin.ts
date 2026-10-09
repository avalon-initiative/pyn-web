import type { AccountInfo, AccountMe, AdminAccountStatus } from '../types/admin.types'
import type { AuditPage } from '../types/repo.types'
import { send } from './auth'

const account = (user: string) => `/v1/admin/users/${encodeURIComponent(user)}`

export const fetchMe = () => send<AccountMe>('GET', '/v1/me')

export const listAccounts = (status: AdminAccountStatus | '') =>
  send<AccountInfo[]>('GET', `/v1/admin/users${status ? `?status=${status}` : ''}`)

export const approveAccount = (user: string) =>
  send<AccountInfo>('POST', `${account(user)}/approve`)

export const disableAccount = (user: string, reason: string) =>
  send<AccountInfo>('POST', `${account(user)}/disable`, { reason: reason.trim() || null })

export const enableAccount = (user: string) => send<AccountInfo>('POST', `${account(user)}/enable`)

export const listServerAudit = (before?: number) =>
  send<AuditPage>('GET', `/v1/admin/audit${before === undefined ? '' : `?before=${before}`}`)
