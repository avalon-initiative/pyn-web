import { api, call } from './http'

export const changePassword = (current: string, next: string) =>
  call<void>(api.PUT('/v1/me/password', { body: { current, new: next } }))
