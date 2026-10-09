import type { AuditPage } from '../types/repo.types'
import type {
  CreationRule,
  MemberCreation,
  NewOrgMember,
  OrgInfo,
  OrgMember,
  OrgRole,
  RepoPolicy,
  RuleRef,
  RuleScope,
} from '../types/org.types'
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

const rule = (org: string, r: RuleRef) =>
  `${base(org)}/repo-policy/rules/${r.effect}/${r.kind}/${encodeURIComponent(r.subject)}`

export const getRepoPolicy = (org: string) => send<RepoPolicy>('GET', `${base(org)}/repo-policy`)

export const setMemberCreation = (org: string, member_creation: MemberCreation) =>
  send<RepoPolicy>('PUT', `${base(org)}/repo-policy`, { member_creation })

export const setCreationRule = (org: string, r: RuleRef, scope: RuleScope) =>
  send<CreationRule>('PUT', rule(org, r), { scope })

export const removeCreationRule = (org: string, r: RuleRef) => send<void>('DELETE', rule(org, r))
