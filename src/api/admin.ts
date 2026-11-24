import type {
  AccountInfo,
  AdminAccountStatus,
  DeleteAccountRequest,
} from '@avalon-initiative/pyn-common-ui'
import type { TwoFactorSetting } from '@avalon-initiative/pyn-common-ui'
import type { Schemas } from './schema'
import type { AccountMe, AdminSettings, UpdateStatus } from '../types/admin.types'
import type {
  CreatedServerInvitation,
  ServerInvitation,
  ServerInvitationRequest,
} from '../types/server-invitation.types'
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

export const grantAdmin = (user: string) =>
  call<AccountInfo>(api.PUT('/v1/admin/users/{user}/admin', path(user)))

export const revokeAdmin = (user: string) =>
  call<AccountInfo>(api.DELETE('/v1/admin/users/{user}/admin', path(user)))

export const listServerAudit = (before?: number) =>
  call<AuditPage>(api.GET('/v1/admin/audit', { params: { query: { before } } }))

export const deleteAccount = (r: DeleteAccountRequest) =>
  call<Schemas['AdminDeleteAccountResult']>(
    api.POST('/v1/admin/users/{user}/delete', {
      ...path(r.user),
      body: { reason: r.reason, immediately: r.immediately },
    }),
  )

export const fetchAdminSettings = () => call<AdminSettings>(api.GET('/v1/admin/settings'))

export const sendTestEmail = () =>
  call<Schemas['TestEmailResult']>(api.POST('/v1/admin/email/test'))

export const fetchUpdateStatus = () => call<UpdateStatus>(api.GET('/v1/admin/update'))

export const fetchAccessMode = () => call<Schemas['SetupStatus']>(api.GET('/v1/setup'))

export const setAccessMode = (access_mode: Schemas['AccessMode']) =>
  call<Schemas['ServerAccess']>(api.PUT('/v1/admin/access', { body: { access_mode } }))

export const getServerTwoFactor = () => call<TwoFactorSetting>(api.GET('/v1/admin/two-factor'))

export const setServerTwoFactor = (required: boolean, grace_days: number) =>
  call<TwoFactorSetting>(api.PUT('/v1/admin/two-factor', { body: { required, grace_days } }))

export const resetTwoFactor = (user: string) =>
  call<void>(api.POST('/v1/admin/users/{user}/two-factor/reset', path(user)))

export const listServerInvitations = () =>
  call<ServerInvitation[]>(api.GET('/v1/admin/invitations'))

export const createServerInvitation = (body: ServerInvitationRequest) =>
  call<CreatedServerInvitation>(api.POST('/v1/admin/invitations', { body }))

export const revokeServerInvitation = (id: string) =>
  call<void>(api.DELETE('/v1/admin/invitations/{id}', { params: { path: { id } } }))

export const addAccount = (username: string, password: string) =>
  call<AccountInfo>(api.POST('/v1/admin/users', { body: { username, password } }))

export const resendConfirmation = (user: string) =>
  call<void>(api.POST('/v1/admin/users/{user}/resend-confirmation', path(user)))
