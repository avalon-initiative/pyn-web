import type { Member } from '../types/repo.types'
import type { Grantee, MemberSource, RepoTeam } from '../types/team.types'
import { orgPath } from './org.state'

/** The app route of a team page; `team` is empty for the list. */
export const teamPath = (org: string, team = ''): string =>
  orgPath(org, team ? `teams/${encodeURIComponent(team)}` : 'teams')

export const personGrantees = (members: Member[]): Grantee[] =>
  members.map((m) => ({ name: m.user, role: m.role, source: m.source }))

export const teamGrantees = (org: string, teams: RepoTeam[]): Grantee[] =>
  teams.map((t) => ({ name: t.slug, role: t.role, href: teamPath(org, t.slug) }))

/** Only a direct grant can be changed from the members list. */
export const isEditable = (g: Grantee): boolean => g.source === undefined || g.source === 'direct'

const SOURCE_NOTES: Record<MemberSource, string> = {
  direct: '',
  team: 'Comes from a team. Change the team grant instead.',
  org_owner: 'Comes from owning the organization.',
}

export const sourceNote = (source: MemberSource | undefined): string =>
  source ? SOURCE_NOTES[source] : ''

/** Organization members who are not yet in the team. */
export const teamCandidates = (orgMembers: string[], inTeam: string[]): string[] =>
  orgMembers.filter((u) => !inTeam.includes(u)).sort()

/** Teams that hold no role in the repository yet. */
export const ungrantedTeams = (all: { slug: string }[], granted: RepoTeam[]): string[] =>
  all.filter((t) => !granted.some((g) => g.slug === t.slug)).map((t) => t.slug)

/** A team's address in a repository role list: `owner/name`. */
export const splitRepo = (repo: string): { owner: string; name: string } => {
  const [owner, ...rest] = repo.split('/')
  return { owner, name: rest.join('/') }
}
