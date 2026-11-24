import { api, call } from './http'
import type { CreateTagRequest, Tag } from '../types/repo.types'

type Repo = { owner: string; name: string }

const at = (r: Repo, tag: string) => ({ params: { path: { ...r, tag } } })

export const listTags = (r: Repo) =>
  call<Tag[]>(api.GET('/v1/repos/{owner}/{name}/tags', { params: { path: r } }))

export const createTag = (r: Repo, body: CreateTagRequest) =>
  call<Tag>(api.POST('/v1/repos/{owner}/{name}/tags', { params: { path: r }, body }))

export const getTag = (r: Repo, tag: string) =>
  call<Tag>(api.GET('/v1/repos/{owner}/{name}/tags/{tag}', at(r, tag)))

export const deleteTag = (r: Repo, tag: string) =>
  call<void>(api.DELETE('/v1/repos/{owner}/{name}/tags/{tag}', at(r, tag)))
