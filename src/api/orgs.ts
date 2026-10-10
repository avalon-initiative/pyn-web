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
import { api, call } from './http'
import type { Schemas } from './schema'

// The server types an organization's `role` as a plain string; it is `owner` or `member`.
const asOrg = (o: Promise<Schemas['OrgInfo']>) => o as Promise<OrgInfo>
const asOrgs = (o: Promise<Schemas['OrgInfo'][]>) => o as Promise<OrgInfo[]>

const org_ = (org: string) => ({ params: { path: { org } } })
const rule = (org: string, r: RuleRef) => ({ params: { path: { org, ...r } } })

export const listMyOrgs = () => asOrgs(call(api.GET('/v1/me/orgs')))

export const createOrg = (name: string) => asOrg(call(api.POST('/v1/orgs', { body: { name } })))

export const getOrg = (org: string) => asOrg(call(api.GET('/v1/orgs/{org}', org_(org))))

export const deleteOrg = (org: string) => call<void>(api.DELETE('/v1/orgs/{org}', org_(org)))

export const listOrgAudit = (org: string, before?: number) =>
  call<AuditPage>(api.GET('/v1/orgs/{org}/audit', { params: { path: { org }, query: { before } } }))

export const listOrgMembers = (org: string) =>
  call<OrgMember[]>(api.GET('/v1/orgs/{org}/members', org_(org)))

export const addOrgMember = (org: string, m: NewOrgMember) =>
  call<OrgMember>(api.POST('/v1/orgs/{org}/members', { ...org_(org), body: m }))

export const setOrgRole = (org: string, user: string, role: OrgRole) =>
  call<OrgMember>(
    api.PATCH('/v1/orgs/{org}/members/{user}', { params: { path: { org, user } }, body: { role } }),
  )

export const removeOrgMember = (org: string, user: string) =>
  call<void>(api.DELETE('/v1/orgs/{org}/members/{user}', { params: { path: { org, user } } }))

export const getRepoPolicy = (org: string) =>
  call<RepoPolicy>(api.GET('/v1/orgs/{org}/repo-policy', org_(org)))

export const setMemberCreation = (org: string, member_creation: MemberCreation) =>
  call<RepoPolicy>(
    api.PUT('/v1/orgs/{org}/repo-policy', { ...org_(org), body: { member_creation } }),
  )

export const setCreationRule = (org: string, r: RuleRef, scope: RuleScope) =>
  call<CreationRule>(
    api.PUT('/v1/orgs/{org}/repo-policy/rules/{effect}/{kind}/{subject}', {
      ...rule(org, r),
      body: { scope },
    }),
  )

export const removeCreationRule = (org: string, r: RuleRef) =>
  call<void>(api.DELETE('/v1/orgs/{org}/repo-policy/rules/{effect}/{kind}/{subject}', rule(org, r)))
