import { repoPath, type ForkLink, type SocialButton } from '@avalon-initiative/pyn-common-ui'
import type { RepoDetails } from '../types/repo.types'

/** Signed-out viewers cannot fork, nor anyone a private source that does not allow forks. */
export const canFork = (repo: RepoDetails, signedOut: boolean) =>
  !signedOut && (repo.visibility !== 'private' || repo.allow_private_forks)

export const forkButton = (repo: RepoDetails, signedOut: boolean): SocialButton => ({
  count: repo.fork_count,
  disabled: !canFork(repo, signedOut),
})

export const forkLinks = (forks: RepoDetails[]): ForkLink[] =>
  forks.map((f) => ({ owner: f.owner, name: f.name, href: repoPath(f) }))

export const forkOf = (repo: RepoDetails): ForkLink | undefined =>
  repo.fork_of ? { ...repo.fork_of, href: repoPath(repo.fork_of) } : undefined

/** The first owner not known to hold a repository of the fork's name; the first owner when all do. */
export const defaultForkOwner = (owners: string[], taken: ReadonlySet<string>) =>
  owners.find((o) => !taken.has(o)) ?? owners[0] ?? ''
