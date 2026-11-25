import { repoSlug } from '@avalon-initiative/pyn-common-ui'
import type { RepoInfo } from '@avalon-initiative/pyn-common-ui'

export function sortRepos<T extends RepoInfo>(repos: T[]): T[] {
  return [...repos].sort((a, b) => repoSlug(a).localeCompare(repoSlug(b)))
}
