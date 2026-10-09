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

/** Mirrors the server's `Me`. */
export interface Me {
  user: string
  permissions: string[]
}

export interface FilePage {
  entries: FileRow[]
  next_after: string | null
}

/** Mirrors the server's `MyLock`: a lock the caller holds, with its repository. */
export interface MyLock {
  owner: string
  name: string
  path: string
  acquired_at: string
  expires_at: string
}

/** A lock that could not be released, with the reason shown beside it. */
export interface ReleaseFailure {
  lock: MyLock
  message: string
}
