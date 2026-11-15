import { api, call } from './http'

/** Omit `current` to set a first password on an account that has none. */
export const changePassword = (current: string | undefined, next: string) =>
  call<void>(api.PUT('/v1/me/password', { body: { current, new: next } }))
