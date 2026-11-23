import type {
  InvitationGrantRole,
  InvitationGrantTarget,
  OrgInfo,
  RepoInfo,
} from '@avalon-initiative/pyn-common-ui'

/** The roles the server accepts in a grant: repository roles and organization roles. */
export const INVITATION_ROLES: InvitationGrantRole[] = [
  { kind: 'repository', value: 'reader' },
  { kind: 'repository', value: 'writer' },
  { kind: 'repository', value: 'maintainer' },
  { kind: 'repository', value: 'admin' },
  { kind: 'organization', value: 'member' },
  { kind: 'organization', value: 'owner' },
]

/** Organizations, then personal repositories; an organization's repository is reached through the organization. */
export function invitationTargets(repos: RepoInfo[], orgs: OrgInfo[]): InvitationGrantTarget[] {
  const orgNames = new Set(orgs.map((o) => o.name))
  return [
    ...orgs.map((o): InvitationGrantTarget => ({ kind: 'organization', name: o.name })),
    ...repos
      .filter((r) => !orgNames.has(r.owner))
      .map((r): InvitationGrantTarget => ({ kind: 'repository', name: `${r.owner}/${r.name}` })),
  ]
}
