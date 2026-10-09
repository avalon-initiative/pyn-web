import type { OrgInfo, OrgMember, RepoPolicy } from '../types/org.types'
import type { RepoTeam, TeamInfo } from '../types/team.types'

export const orgs: OrgInfo[] = [
  { name: 'studio', created_at: '2026-09-02T08:00:00Z', role: 'owner' },
  { name: 'modding-club', created_at: '2026-09-20T12:30:00Z', role: 'member' },
]

export const orgMembers: OrgMember[] = [
  { user: 'alice', role: 'owner' },
  { user: 'bob', role: 'member' },
  { user: 'carol', role: 'member' },
]

export const teams: TeamInfo[] = [
  {
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
    slug: 'qa',
    name: 'qa',
    description: '',
    created_at: '2026-09-12T14:30:00Z',
    members: [],
    repos: [],
  },
]

export const repoTeams: RepoTeam[] = [
  { slug: 'artists', name: 'Artists', description: 'Texture and model work.', role: 'writer' },
]

export const repoPolicy: RepoPolicy = {
  member_creation: 'private',
  rules: [
    { effect: 'allow', kind: 'team', subject: 'artists', scope: 'both' },
    { effect: 'deny', kind: 'user', subject: 'carol', scope: 'public' },
    { effect: 'allow', kind: 'role', subject: 'member', scope: 'private' },
  ],
}
