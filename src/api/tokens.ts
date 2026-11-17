import type { CreatedToken, TokenForm, TokenInfo } from '@avalon-initiative/pyn-common-ui'
import { api, call } from './http'
import type { components } from './schema.gen'

type Grant = components['schemas']['TokenPermission']
type WireToken = components['schemas']['TokenInfo']
type WireCreated = components['schemas']['CreatedToken']
type TokenBody = components['schemas']['CreateTokenRequest']

const GRANTS: Record<string, Grant> = {
  read: { resource: 'contents', level: 'read' },
  checkin: { resource: 'contents', level: 'write' },
  restore: { resource: 'contents', level: 'write' },
  lock: { resource: 'locks', level: 'write' },
  force_unlock: { resource: 'locks', level: 'admin' },
  edit_policy: { resource: 'policy', level: 'write' },
  manage_users: { resource: 'members', level: 'write' },
  manage_roles: { resource: 'administration', level: 'write' },
  view_audit: { resource: 'audit', level: 'read' },
}

const RANK: Record<string, number> = { read: 0, write: 1, admin: 2 }

const grantsOf = (permissions: string[]): Grant[] => {
  const best = new Map<string, Grant>([['metadata', { resource: 'metadata', level: 'read' }]])
  for (const name of permissions) {
    const grant = GRANTS[name]
    const have = grant && best.get(grant.resource)
    if (grant && (!have || RANK[grant.level] > RANK[have.level])) best.set(grant.resource, grant)
  }
  return [...best.values()]
}

export const tokenBody = (form: TokenForm): TokenBody => ({
  name: form.name,
  permissions: grantsOf(form.permissions),
  repository_access: form.repos.length ? { mode: 'selected', repos: form.repos } : { mode: 'all' },
  ...(form.expires_at ? { expires_at: form.expires_at } : { never: true }),
})

export const tokenInfo = (t: WireToken): TokenInfo => ({
  id: t.id,
  user: t.user,
  name: t.name,
  repos: t.repository_access.repos ?? [],
  permissions: t.permissions.map((p) => `${p.resource}:${p.level}`),
  created_at: t.created_at,
  expires_at: t.expires_at,
  last_used_at: t.last_used_at,
  revoked_at: t.revoked_at,
})

export const listTokens = async () =>
  (await call<WireToken[]>(api.GET('/v1/tokens'))).map(tokenInfo)

export const createToken = async (form: TokenForm): Promise<CreatedToken> => {
  const created = await call<WireCreated>(api.POST('/v1/tokens', { body: tokenBody(form) }))
  return { token: created.token, info: tokenInfo(created.info) }
}

export const revokeToken = (id: string) =>
  call<void>(api.DELETE('/v1/tokens/{id}', { params: { path: { id } } }))
