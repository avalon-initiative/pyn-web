import { repoSlug } from '@avalon-initiative/pyn-common-ui'
import type { RepoInfo, RepoListItem } from '@avalon-initiative/pyn-common-ui'
import type { RepoDetails } from '../types/repo.types'

export function sortRepos<T extends RepoInfo>(repos: T[]): T[] {
  return [...repos].sort((a, b) => repoSlug(a).localeCompare(repoSlug(b)))
}

/** List rows with the owner's avatar: `owner_identity` carries it for an organization, `ownerAvatar` for a known owner. */
export function repoRows(repos: RepoDetails[], ownerAvatar?: string | null): RepoListItem[] {
  return repos.map((r) => ({
    ...r,
    owner_avatar_url: r.owner_identity?.avatar_url ?? ownerAvatar ?? null,
  }))
}
