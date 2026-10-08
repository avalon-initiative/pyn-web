/** Mirrors the server's `Lock`. */
export interface LockInfo {
  path: string
  owner: string
  acquired_at: string
  expires_at: string
}

export type LockState = 'available' | 'locked' | 'mine' | 'expiring'

export type Mode = 'shared' | 'exclusive'

export interface FileRow {
  path: string
  mode: Mode
  /** Head revision, if the file has any. */
  revision?: number
  lock?: LockInfo
}
