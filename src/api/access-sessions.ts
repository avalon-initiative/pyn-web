import type {
  AccessSessionInfo,
  AccessSessionStart,
  StartedAccessSession,
} from '@avalon-initiative/pyn-common-ui'
import type { Schemas } from './schema'
import { toAccessSession } from '../types/access-session.types'
import { api, call } from './http'

export const fetchOwnAccessSessions = async (): Promise<AccessSessionInfo[]> =>
  (await call<Schemas['AccessSessionInfo'][]>(api.GET('/v1/me/access-sessions'))).map(
    toAccessSession,
  )

export const listAccessSessions = async (user?: string): Promise<AccessSessionInfo[]> =>
  (
    await call<Schemas['AccessSessionInfo'][]>(
      api.GET('/v1/admin/access-sessions', { params: { query: { user: user || undefined } } }),
    )
  ).map(toAccessSession)

export const startAccessSession = async (
  user: string,
  r: AccessSessionStart,
): Promise<StartedAccessSession> => {
  const started = await call<Schemas['StartedAccessSession']>(
    api.POST('/v1/admin/users/{user}/access-sessions', {
      params: { path: { user } },
      body: { reason: r.reason, notes: r.notes?.trim() || null },
    }),
  )
  return { secret: started.secret, info: toAccessSession(started.info) }
}

export const endAccessSession = async (id: string): Promise<AccessSessionInfo> =>
  toAccessSession(
    await call<Schemas['AccessSessionInfo']>(
      api.POST('/v1/admin/access-sessions/{id}/end', { params: { path: { id } } }),
    ),
  )
