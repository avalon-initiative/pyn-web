import type { RepoDetails } from '../../src/types/repo.types'

/** The listing fields a new, empty repository reports. */
export const repoExtras = {
  allow_private_forks: false,
  description: null,
  website: null,
  topics: [],
  languages: [],
  language: null,
  updated_at: null,
  fork_of: null,
  fork_count: 0,
  star_count: 0,
  starred: false,
  watcher_count: 0,
  watching: null,
  icon_url: null,
} satisfies Partial<RepoDetails>

export const sampleRepos: RepoDetails[] = [
  ['alice', 'castle-quest', 'private'],
  ['alice', 'core-engine', 'private'],
  ['alice', 'shared-assets', 'public'],
].map(([owner, name, visibility]) => ({
  id: `repo-${owner}-${name}`,
  owner_id: `owner-${owner}`,
  owner,
  name,
  visibility: visibility as RepoDetails['visibility'],
  max_locks_per_user: 10,
  max_locks_set_by_policy: false,
  lease_hours: 24,
  created_at: '2026-10-01T09:00:00Z',
  role: 'admin' as const,
  ...repoExtras,
}))
