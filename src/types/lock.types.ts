import type { Schemas } from '../api/schema'

export type LockInfo = Schemas['Lock']
export type Mode = Schemas['Mode']
export type FileRow = Schemas['FileEntry']
export type Me = Schemas['Me']
export type FilePage = Schemas['FilePage']
export type MyLock = Schemas['MyLock']

export type LockState = 'available' | 'locked' | 'mine' | 'expiring'

/** A lock that could not be released, with the reason shown beside it. */
export interface ReleaseFailure {
  lock: MyLock
  message: string
}
