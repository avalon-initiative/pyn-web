import type { LockInfo } from '../types/lock.types'
import type { RepoInfo } from '../types/repo.types'
import type { RepoSummary, TreeEntry, TreeListing } from '../types/tree.types'

export const now = new Date('2026-10-08T12:00:00Z')

export const repo: RepoInfo = {
  owner: 'acme',
  name: 'castle-quest',
  visibility: 'private',
  max_locks_per_user: 10,
  max_locks_set_by_policy: false,
  lease_hours: 24,
  created_at: '2026-04-12T09:00:00Z',
  role: 'admin',
}

const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString()

export const lock = (path: string, owner: string, minutesLeft: number): LockInfo => ({
  path,
  owner,
  acquired_at: ago(1),
  expires_at: new Date(now.getTime() + minutesLeft * 60_000).toISOString(),
})

const change = (id: number, path: string, author: string, message: string, hours: number) => ({
  id,
  path,
  author,
  message,
  content: 'c0ffee',
  created_at: ago(hours),
})

export const rootEntries: TreeEntry[] = [
  {
    name: 'Content',
    path: 'Content',
    kind: 'folder',
    mode: 'mixed',
    last_change: change(61, 'Content/Levels/Level01.umap', 'jamie', 'Level design changes', 2),
  },
  {
    name: 'Config',
    path: 'Config',
    kind: 'folder',
    mode: 'exclusive',
    last_change: change(12, 'Config/DefaultGame.ini', 'alex', 'Update production settings', 3),
  },
  {
    name: 'Source',
    path: 'Source',
    kind: 'folder',
    mode: 'shared',
    last_change: change(382, 'Source/Player.cpp', 'taylor', 'Refactor player controller', 5),
  },
  {
    name: 'Game.uproject',
    path: 'Game.uproject',
    kind: 'file',
    mode: 'shared',
    last_change: change(4, 'Game.uproject', 'alex', 'Update project settings', 5),
  },
  {
    name: 'README.md',
    path: 'README.md',
    kind: 'file',
    mode: 'shared',
    last_change: change(2, 'README.md', 'jamie', 'Update readme', 26),
  },
  {
    name: 'Level02.umap',
    path: 'Level02.umap',
    kind: 'file',
    mode: 'exclusive',
    lock: lock('Level02.umap', 'bob', 15),
  },
]

export const rootListing: TreeListing = { path: '', entries: rootEntries }

export const folderListing: TreeListing = {
  path: 'Content/Levels',
  entries: [
    {
      name: 'Level01.umap',
      path: 'Content/Levels/Level01.umap',
      kind: 'file',
      mode: 'exclusive',
      last_change: change(61, 'Content/Levels/Level01.umap', 'jamie', 'Level design changes', 2),
      lock: lock('Content/Levels/Level01.umap', 'jamie', 222),
    },
    {
      name: 'Notes.md',
      path: 'Content/Levels/Notes.md',
      kind: 'file',
      mode: 'shared',
      last_change: change(3, 'Content/Levels/Notes.md', 'alex', 'Add level notes', 30),
    },
  ],
}

export const summary: RepoSummary = {
  default_branch: 'main',
  branch_count: 1,
  files: 5,
  exclusive_files: 2,
  shared_files: 3,
  updated_at: ago(2),
  locks: [lock('Content/Levels/Level01.umap', 'jamie', 222), lock('Level02.umap', 'bob', 15)],
  activity: [
    { id: 9, at: ago(2), actor: 'jamie', action: 'checkout', path: 'Content/Levels/Level01.umap' },
    { id: 8, at: ago(2.5), actor: 'alex', action: 'checkin', path: 'Config/DefaultGame.ini' },
    { id: 7, at: ago(30), actor: 'taylor', action: 'release', path: 'Source/Player.cpp' },
  ],
}
