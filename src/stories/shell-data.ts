import type { RepoInfo } from '../types/repo.types'

export const sampleRepos: RepoInfo[] = [
  ['alice', 'castle-quest', 'private'],
  ['alice', 'core-engine', 'private'],
  ['alice', 'shared-assets', 'public'],
].map(([owner, name, visibility]) => ({
  owner,
  name,
  visibility: visibility as RepoInfo['visibility'],
  lease_hours: 24,
  created_at: '2026-10-01T09:00:00Z',
  role: 'admin',
}))
