import type { ExternalIdentity } from '../types/auth.types'
import { api, call } from './http'

export const listIdentities = () => call<ExternalIdentity[]>(api.GET('/v1/me/identities'))

export const unlinkIdentity = (id: string) =>
  call<void>(api.DELETE('/v1/me/identities/{id}', { params: { path: { id } } }))

/** The provider URL to navigate to; the identity it signs in as gets linked. */
export const startLink = async (returnTo: string) =>
  (
    await call<{ url: string }>(
      api.POST('/v1/oidc/link', { params: { query: { return_to: returnTo } } }),
    )
  ).url
