import type { RepoTeam, TeamInfo } from '../types/team.types'
import { send } from './auth'

type Repo = { owner: string; name: string }

const base = (org: string) => `/v1/orgs/${encodeURIComponent(org)}/teams`
const team = (org: string, slug: string) => `${base(org)}/${encodeURIComponent(slug)}`
const teamMember = (org: string, slug: string, user: string) =>
  `${team(org, slug)}/members/${encodeURIComponent(user)}`
const repoTeam = (r: Repo, slug: string) =>
  `/v1/repos/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.name)}/teams/${encodeURIComponent(slug)}`

export const listTeams = (org: string) => send<TeamInfo[]>('GET', base(org))

export const createTeam = (org: string, t: { slug: string; name?: string; description?: string }) =>
  send<TeamInfo>('POST', base(org), t)

export const getTeam = (org: string, slug: string) => send<TeamInfo>('GET', team(org, slug))

export const updateTeam = (org: string, slug: string, t: { name?: string; description?: string }) =>
  send<TeamInfo>('PATCH', team(org, slug), t)

export const deleteTeam = (org: string, slug: string) => send<void>('DELETE', team(org, slug))

export const addTeamMember = (org: string, slug: string, user: string) =>
  send<void>('PUT', teamMember(org, slug, user))

export const removeTeamMember = (org: string, slug: string, user: string) =>
  send<void>('DELETE', teamMember(org, slug, user))

export const listRepoTeams = (r: Repo) =>
  send<RepoTeam[]>(
    'GET',
    `/v1/repos/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.name)}/teams`,
  )

export const setRepoTeam = (r: Repo, slug: string, role: string) =>
  send<void>('PUT', repoTeam(r, slug), { role })

export const removeRepoTeam = (r: Repo, slug: string) => send<void>('DELETE', repoTeam(r, slug))
