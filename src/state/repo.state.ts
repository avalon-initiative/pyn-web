import { repoSlug } from '@avalon-initiative/pyn-common-ui'
import type { RailRepo, RepoInfo, RepoListItem } from '@avalon-initiative/pyn-common-ui'
import type { RepoDetails } from '../types/repo.types'

export function sortRepos<T extends RepoInfo>(repos: T[]): T[] {
  return [...repos].sort((a, b) => repoSlug(a).localeCompare(repoSlug(b)))
}

/** List rows with the icon, else the owner's avatar; both given even when null, so initials stand in last. */
export function repoRows(repos: RepoDetails[]): RepoListItem[] {
  return repos.map((r) => ({
    ...r,
    icon_url: r.icon_url ?? null,
    owner_avatar_url: r.owner_identity?.avatar_url ?? null,
  }))
}

/** Side rail entries with the same pictures as the rows. */
export const railRepos = (repos: RepoDetails[]): RailRepo[] =>
  repos.map((r) => ({
    owner: r.owner,
    name: r.name,
    iconUrl: r.icon_url ?? null,
    ownerAvatarUrl: r.owner_identity?.avatar_url ?? null,
  }))
