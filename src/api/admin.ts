import type { AccountInfo, AdminAccountStatus } from '@avalon-initiative/pyn-common-ui'
import type { AccountMe } from '../types/admin.types'
import type { AuditPage } from '../types/repo.types'
import { api, call } from './http'

const path = (user: string) => ({ params: { path: { user } } })

export const fetchMe = () => call<AccountMe>(api.GET('/v1/me'))

export const listAccounts = (status: AdminAccountStatus | '') =>
  call<AccountInfo[]>(
    api.GET('/v1/admin/users', { params: { query: { status: status || undefined } } }),
  )

export const approveAccount = (user: string) =>
  call<AccountInfo>(api.POST('/v1/admin/users/{user}/approve', path(user)))

export const disableAccount = (user: string, reason: string) =>
  call<AccountInfo>(
    api.POST('/v1/admin/users/{user}/disable', {
      ...path(user),
      body: { reason: reason.trim() || null },
    }),
  )

export const enableAccount = (user: string) =>
  call<AccountInfo>(api.POST('/v1/admin/users/{user}/enable', path(user)))

export const listServerAudit = (before?: number) =>
  call<AuditPage>(api.GET('/v1/admin/audit', { params: { query: { before } } }))
