import { isOrgOwner } from '@avalon-initiative/pyn-common-ui'
import type { OrgInfo } from '@avalon-initiative/pyn-common-ui'
import { EDIT_POLICY } from './policy.state'

export const isRepoOwner = (owner: string, user: string, org: OrgInfo | null) =>
  owner === user || isOrgOwner(org)

/** Settings holds owner-only sections and the policy editor; anyone who may use one gets the page. */
export const canOpenSettings = (permissions: string[], owner: boolean) =>
  owner || permissions.includes(EDIT_POLICY)
