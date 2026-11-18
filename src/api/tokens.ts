import type { CreatedToken, TokenForm, TokenInfo } from '@avalon-initiative/pyn-common-ui'
import { api, call } from './http'
import type { components } from './schema.gen'

type Wire = components['schemas']
// The wire types carry mode and level as plain strings; the library narrows them to unions.

export const listTokens = async () =>
  (await call<Wire['TokenInfo'][]>(api.GET('/v1/tokens'))) as TokenInfo[]

export const createToken = async (form: TokenForm) =>
  (await call<Wire['CreatedToken']>(api.POST('/v1/tokens', { body: form }))) as CreatedToken

export const revokeToken = (id: string) =>
  call<void>(api.DELETE('/v1/tokens/{id}', { params: { path: { id } } }))
