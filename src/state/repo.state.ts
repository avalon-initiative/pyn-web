import { repoSlug } from '@avalon-initiative/pyn-common-ui'
import type { RepoInfo } from '../types/repo.types'

export function sortRepos(repos: RepoInfo[]): RepoInfo[] {
  return [...repos].sort((a, b) => repoSlug(a).localeCompare(repoSlug(b)))
}
