import type {
  OwnerUsage,
  RepoUsage,
  RepoUsageBreakdown,
  SetRepoStorageCapRequest,
} from '@avalon-initiative/pyn-common-ui'
import { api, call } from './http'

type Repo = { owner: string; name: string }

const at = (r: Repo) => ({ params: { path: r } })

export const getOwnerUsage = (owner: string) =>
  call<OwnerUsage>(api.GET('/v1/owners/{owner}/usage', { params: { path: { owner } } }))

export const getRepoUsage = (r: Repo) =>
  call<RepoUsage>(api.GET('/v1/repos/{owner}/{name}/usage', at(r)))

export const getRepoBreakdown = (r: Repo) =>
  call<RepoUsageBreakdown>(api.GET('/v1/repos/{owner}/{name}/usage/breakdown', at(r)))

export const setRepoStorageCap = (r: Repo, body: SetRepoStorageCapRequest) =>
  call<SetRepoStorageCapRequest>(
    api.PUT('/v1/repos/{owner}/{name}/storage-cap', { ...at(r), body }),
  )
