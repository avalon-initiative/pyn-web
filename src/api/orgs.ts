import type {
  NewOrgMember,
  OrgInvitation,
  OwnerFreeze,
  RuleRef,
} from '@avalon-initiative/pyn-common-ui'
import type { AuditPage } from '../types/repo.types'
import type {
  CreationRule,
  MemberCreation,
  OrgInfo,
  OrgMember,
  OrgRole,
  RepoPolicy,
  RuleScope,
} from '@avalon-initiative/pyn-common-ui'
import { api, call } from './http'

const org_ = (org: string) => ({ params: { path: { org } } })
const rule = (org: string, r: RuleRef) => ({ params: { path: { org, ...r } } })

export const listMyOrgs = () => call<OrgInfo[]>(api.GET('/v1/me/orgs'))

export const createOrg = (name: string) => call<OrgInfo>(api.POST('/v1/orgs', { body: { name } }))

export const getOrg = (org: string) => call<OrgInfo>(api.GET('/v1/orgs/{org}', org_(org)))

export const deleteOrg = (org: string) => call<void>(api.DELETE('/v1/orgs/{org}', org_(org)))

export const listOrgAudit = (org: string, before?: number) =>
  call<AuditPage>(api.GET('/v1/orgs/{org}/audit', { params: { path: { org }, query: { before } } }))

export const listOrgMembers = (org: string) =>
  call<OrgMember[]>(api.GET('/v1/orgs/{org}/members', org_(org)))

export type AddOutcome = { invited: OrgInvitation } | { added: OrgMember }

/** 202 is an invitation; 201 is a direct add by a server administrator. */
export async function addOrgMember(org: string, m: NewOrgMember): Promise<AddOutcome> {
  const data = await call<OrgInvitation | OrgMember>(
    api.POST('/v1/orgs/{org}/members', { ...org_(org), body: m }),
  )
  return 'invited_by' in data ? { invited: data } : { added: data }
}

export const listOrgInvitations = (org: string) =>
  call<OrgInvitation[]>(api.GET('/v1/orgs/{org}/invitations', org_(org)))

export const cancelOrgInvitation = (org: string, user: string) =>
  call<void>(api.DELETE('/v1/orgs/{org}/invitations/{user}', { params: { path: { org, user } } }))

export const listMyInvitations = () => call<OrgInvitation[]>(api.GET('/v1/me/invitations'))

export const acceptInvitation = (org: string) =>
  call<OrgInfo>(api.POST('/v1/me/invitations/{org}/accept', org_(org)))

export const declineInvitation = (org: string) =>
  call<void>(api.POST('/v1/me/invitations/{org}/decline', org_(org)))

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

export const getOwnerFreeze = (owner: string) =>
  call<OwnerFreeze>(api.GET('/v1/owners/{owner}/freeze', { params: { path: { owner } } }))
