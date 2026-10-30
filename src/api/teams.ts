import { api, call } from './http'
import type { Schemas } from './schema'

type TeamInfo = Schemas['TeamInfo']
type RepoTeam = Schemas['RepoTeam']

type Repo = { owner: string; name: string }

export const listTeams = (org: string) =>
  call<TeamInfo[]>(api.GET('/v1/orgs/{org}/teams', { params: { path: { org } } }))

export const createTeam = (org: string, t: { slug: string; name?: string; description?: string }) =>
  call<TeamInfo>(api.POST('/v1/orgs/{org}/teams', { params: { path: { org } }, body: t }))

export const getTeam = (org: string, team: string) =>
  call<TeamInfo>(api.GET('/v1/orgs/{org}/teams/{team}', { params: { path: { org, team } } }))

export const updateTeam = (org: string, team: string, t: { name?: string; description?: string }) =>
  call<TeamInfo>(
    api.PATCH('/v1/orgs/{org}/teams/{team}', { params: { path: { org, team } }, body: t }),
  )

export const deleteTeam = (org: string, team: string) =>
  call<void>(api.DELETE('/v1/orgs/{org}/teams/{team}', { params: { path: { org, team } } }))

export const addTeamMember = (org: string, team: string, user: string) =>
  call<void>(
    api.PUT('/v1/orgs/{org}/teams/{team}/members/{user}', {
      params: { path: { org, team, user } },
    }),
  )

export const removeTeamMember = (org: string, team: string, user: string) =>
  call<void>(
    api.DELETE('/v1/orgs/{org}/teams/{team}/members/{user}', {
      params: { path: { org, team, user } },
    }),
  )

export const listRepoTeams = (r: Repo) =>
  call<RepoTeam[]>(api.GET('/v1/repos/{owner}/{name}/teams', { params: { path: r } }))

export const setRepoTeam = (r: Repo, team: string, role: string) =>
  call<void>(
    api.PUT('/v1/repos/{owner}/{name}/teams/{team}', {
      params: { path: { ...r, team } },
      body: { role },
    }),
  )

export const removeRepoTeam = (r: Repo, team: string) =>
  call<void>(
    api.DELETE('/v1/repos/{owner}/{name}/teams/{team}', { params: { path: { ...r, team } } }),
  )
