import type { Schemas } from './schema'
import { api, call } from './http'

export type PeoplePage = Schemas['PeoplePage']
export type PersonEntry = Schemas['PersonEntry']

export const listPeople = (query: { q?: string; after?: string; limit?: number } = {}) =>
  call<PeoplePage>(api.GET('/v1/users', { params: { query } }))
