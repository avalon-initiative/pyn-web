import type { Schemas } from './schema'
import { api, call } from './http'

export type PublicProfile = Schemas['PublicProfile']

export const getProfile = (user: string) =>
  call<PublicProfile>(api.GET('/v1/users/{user}', { params: { path: { user } } }))
