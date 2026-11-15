import type { AccountEmail } from '@avalon-initiative/pyn-common-ui'
import { api, call } from './http'

const at = (address: string) => ({ params: { path: { address } } })

export const listEmails = () => call<AccountEmail[]>(api.GET('/v1/me/emails'))

export const addEmail = (address: string) =>
  call<AccountEmail>(api.POST('/v1/me/emails', { body: { address } }))

export const resendEmail = (address: string) =>
  call<void>(api.POST('/v1/me/emails/{address}/resend', at(address)))

export const setPrimaryEmail = (address: string) =>
  call<void>(api.PUT('/v1/me/emails/{address}/primary', at(address)))

export const removeEmail = (address: string) =>
  call<void>(api.DELETE('/v1/me/emails/{address}', at(address)))
