import type { Schemas } from './schema'
import { api, call } from './http'

export type AccountDeletionStatus = Schemas['AccountDeletionStatus']

export const fetchDeletionStatus = () =>
  call<AccountDeletionStatus>(api.GET('/v1/account/deletion'))

export const scheduleDeletion = (password?: string) =>
  call<AccountDeletionStatus>(api.POST('/v1/account/deletion', { body: { password } }))

export const restoreAccount = () =>
  call<AccountDeletionStatus>(api.POST('/v1/account/deletion/restore'))
