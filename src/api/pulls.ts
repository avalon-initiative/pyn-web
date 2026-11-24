import type {
  FileLines,
  NewPull,
  PullListQuery,
  PullMerge,
  PullUpdate,
  ServerPull,
  ServerPullCommit,
  ServerPullEvent,
  ServerPullPage,
  ServerRepoDiff,
} from '../types/pull.types'
import { api, call } from './http'

type Repo = { owner: string; name: string }

const at = (r: Repo, number: number) => ({ params: { path: { ...r, number } } })

export const listPulls = (r: Repo, query: PullListQuery = {}) =>
  call<ServerPullPage>(api.GET('/v1/repos/{owner}/{name}/pulls', { params: { path: r, query } }))

export const createPull = (r: Repo, body: NewPull) =>
  call<ServerPull>(api.POST('/v1/repos/{owner}/{name}/pulls', { params: { path: r }, body }))

export const getPull = (r: Repo, n: number) =>
  call<ServerPull>(api.GET('/v1/repos/{owner}/{name}/pulls/{number}', at(r, n)))

export const updatePull = (r: Repo, n: number, body: PullUpdate) =>
  call<ServerPull>(api.PATCH('/v1/repos/{owner}/{name}/pulls/{number}', { ...at(r, n), body }))

export const pullCommits = (r: Repo, n: number) =>
  call<ServerPullCommit[]>(api.GET('/v1/repos/{owner}/{name}/pulls/{number}/commits', at(r, n)))

export const pullDiff = (r: Repo, n: number) =>
  call<ServerRepoDiff>(api.GET('/v1/repos/{owner}/{name}/pulls/{number}/diff', at(r, n)))

export const pullEvents = (r: Repo, n: number, after?: string, limit = 100) =>
  call<ServerPullEvent[]>(
    api.GET('/v1/repos/{owner}/{name}/pulls/{number}/events', {
      params: { path: { ...r, number: n }, query: { after, limit } },
    }),
  )

export const commentPull = (r: Repo, n: number, body: string) =>
  call<ServerPullEvent>(
    api.POST('/v1/repos/{owner}/{name}/pulls/{number}/comments', { ...at(r, n), body: { body } }),
  )

export const closePull = (r: Repo, n: number) =>
  call<ServerPull>(api.POST('/v1/repos/{owner}/{name}/pulls/{number}/close', at(r, n)))

export const reopenPull = (r: Repo, n: number) =>
  call<ServerPull>(api.POST('/v1/repos/{owner}/{name}/pulls/{number}/reopen', at(r, n)))

export const mergePull = (r: Repo, n: number, body: PullMerge) =>
  call<ServerPull>(api.POST('/v1/repos/{owner}/{name}/pulls/{number}/merge', { ...at(r, n), body }))

export const fileLines = (r: Repo, path: string, rev: string, start: number, end: number) =>
  call<FileLines>(
    api.GET('/v1/repos/{owner}/{name}/lines', {
      params: { path: r, query: { path, rev, start, end } },
    }),
  )
