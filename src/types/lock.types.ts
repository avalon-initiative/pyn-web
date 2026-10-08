/** Mirrors the server's `Lock`. */
export interface LockInfo {
  path: string
  owner: string
  acquired_at: string
  expires_at: string
}

export type LockState = 'available' | 'locked' | 'mine' | 'expiring'

export type Mode = 'shared' | 'exclusive'

/** Mirrors the server's `FileEntry`. */
export interface FileRow {
  path: string
  mode: Mode
  /** Head revision; null for a path that is locked but has no revision yet. */
  revision?: number | null
  lock?: LockInfo | null
}

export interface FilePage {
  entries: FileRow[]
  next_after: string | null
}
