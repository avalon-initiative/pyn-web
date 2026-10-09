import type { AuditPage } from '../types/repo.types'
import type { NewOrgMember, OrgInfo, OrgMember, OrgRole } from '../types/org.types'
import { send } from './auth'

const base = (org: string) => `/v1/orgs/${encodeURIComponent(org)}`
const member = (org: string, user: string) => `${base(org)}/members/${encodeURIComponent(user)}`

export const listMyOrgs = () => send<OrgInfo[]>('GET', '/v1/me/orgs')

export const createOrg = (name: string) => send<OrgInfo>('POST', '/v1/orgs', { name })

export const getOrg = (org: string) => send<OrgInfo>('GET', base(org))

export const deleteOrg = (org: string) => send<void>('DELETE', base(org))

export const listOrgAudit = (org: string, before?: number) =>
  send<AuditPage>('GET', `${base(org)}/audit${before === undefined ? '' : `?before=${before}`}`)

export const listOrgMembers = (org: string) => send<OrgMember[]>('GET', `${base(org)}/members`)

export const addOrgMember = (org: string, m: NewOrgMember) =>
  send<OrgMember>('POST', `${base(org)}/members`, m)

export const setOrgRole = (org: string, user: string, role: OrgRole) =>
  send<OrgMember>('PATCH', member(org, user), { role })

export const removeOrgMember = (org: string, user: string) =>
  send<void>('DELETE', member(org, user))
