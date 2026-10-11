import type { CreatedToken, TokenForm, TokenInfo } from '../types/token.types'
import { api, call } from './http'

export const listTokens = () => call<TokenInfo[]>(api.GET('/v1/tokens'))

export const createToken = (form: TokenForm) =>
  call<CreatedToken>(api.POST('/v1/tokens', { body: form }))

export const revokeToken = (id: string) =>
  call<void>(api.DELETE('/v1/tokens/{id}', { params: { path: { id } } }))
