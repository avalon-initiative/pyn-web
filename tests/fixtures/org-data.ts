import type {
  OrgInfo,
  OrgInvitation,
  OrgMember,
  RepoPolicy,
  RepoTeam,
  TeamInfo,
} from '@avalon-initiative/pyn-common-ui'

export const orgs: OrgInfo[] = [
  { id: 'org-studio', name: 'studio', created_at: '2026-09-02T08:00:00Z', role: 'owner' },
  {
    id: 'org-modding-club',
    name: 'modding-club',
    created_at: '2026-09-20T12:30:00Z',
    role: 'member',
  },
]

export const orgMembers: OrgMember[] = [
  { user: 'alice', role: 'owner' },
  { user: 'bob', role: 'member' },
  { user: 'carol', role: 'member' },
]

export const teams: TeamInfo[] = [
  {
    id: 'team-artists',
    slug: 'artists',
    name: 'Artists',
    description: 'Texture and model work.',
    created_at: '2026-09-10T09:00:00Z',
    members: ['bob', 'carol'],
    repos: [
      { repo: 'studio/game', role: 'writer' },
      { repo: 'studio/assets', role: 'maintainer' },
    ],
  },
  {
    id: 'team-qa',
    slug: 'qa',
    name: 'qa',
    description: '',
    created_at: '2026-09-12T14:30:00Z',
    members: [],
    repos: [],
  },
]

export const repoTeams: RepoTeam[] = [
  {
    team_id: 'team-artists',
    slug: 'artists',
    name: 'Artists',
    description: 'Texture and model work.',
    role: 'writer',
  },
]

export const repoPolicy: RepoPolicy = {
  member_creation: 'private',
  rules: [
    { effect: 'allow', kind: 'team', subject: 'artists', scope: 'both' },
    { effect: 'deny', kind: 'user', subject: 'carol', scope: 'public' },
    { effect: 'allow', kind: 'role', subject: 'member', scope: 'private' },
  ],
}

export const invitations: OrgInvitation[] = [
  {
    org: 'studio',
    user: 'dave',
    role: 'member',
    invited_by: 'alice',
    created_at: '2026-10-01T09:00:00Z',
    expires_at: '2026-10-31T09:00:00Z',
  },
  {
    org: 'modding-club',
    user: 'dave',
    role: 'owner',
    invited_by: 'bob',
    created_at: '2026-10-02T09:00:00Z',
    expires_at: '2026-11-01T09:00:00Z',
  },
]
