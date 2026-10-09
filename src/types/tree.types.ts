import type { LockInfo, Mode } from './lock.types'
import type { Revision } from './repo.types'

export type TreeMode = Mode | 'mixed'

/** Mirrors the server's `TreeEntry`. */
export interface TreeEntry {
  name: string
  path: string
  kind: 'file' | 'folder'
  mode: TreeMode
  /** The newest revision at or under the entry; absent for a locked file with no revision. */
  last_change?: Revision | null
  lock?: LockInfo | null
}

/** Mirrors the server's `TreeListing`. */
export interface TreeListing {
  path: string
  entries: TreeEntry[]
}

/** Mirrors the server's `ActivityEntry`. */
export interface ActivityEntry {
  id: number
  at: string
  actor: string
  action: string
  path?: string | null
}

/** Mirrors the server's `RepoSummary`. */
export interface RepoSummary {
  default_branch: string
  branch_count: number
  files: number
  exclusive_files: number
  shared_files: number
  updated_at?: string | null
  locks: LockInfo[]
  activity: ActivityEntry[]
}

export interface Crumb {
  label: string
  /** Absent on the current location. */
  href?: string
}
