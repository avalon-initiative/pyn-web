import { isOrgOwner } from '@avalon-initiative/pyn-common-ui'
import type { OrgInfo } from '@avalon-initiative/pyn-common-ui'
import { EDIT_POLICY } from './policy.state'

export const MANAGE_ROLES = 'manage_roles'

export const isRepoOwner = (owner: string, user: string, org: OrgInfo | null) =>
  owner === user || isOrgOwner(org)

/** Settings holds owner-only sections and the policy editor; server administrators reach Storage. */
export const canOpenSettings = (permissions: string[], owner: boolean, admin = false) =>
  owner || admin || permissions.includes(EDIT_POLICY)

export const canSeeBreakdown = (permissions: string[], admin: boolean) =>
  admin || permissions.includes(MANAGE_ROLES)

export const canSetCap = (owner: boolean, admin: boolean) => owner || admin

/** The storage section is for those who may set the cap or read the breakdown. */
export const canSeeStorage = (permissions: string[], owner: boolean, admin = false) =>
  canSetCap(owner, admin) || canSeeBreakdown(permissions, admin)
