import type { Schemas } from '../api/schema'

export type RepoInfo = Schemas['RepoInfo']
export type Visibility = Schemas['Visibility']

/** The fields of `CreateRepoRequest` and `UpdateRepoRequest` the UI sets. */
export interface RepoSettings {
  name: string
  visibility: Visibility
  lease_hours: number
  /** Omitted leaves it alone (or the server default on create); null clears to the default. */
  max_locks_per_user?: number | null
}

/** What the repository form edits: the settings plus the lock-limit state the server reports. */
export type RepoFormValue = RepoSettings &
  Partial<Pick<RepoInfo, 'max_locks_per_user_setting' | 'max_locks_set_by_policy'>>

export type Member = Schemas['Member']
export type RoleGrant = Schemas['RoleGrant']
export type InviteInfo = Schemas['InviteInfo']
export type Revision = Schemas['Revision']
export type HistoryPage = Schemas['HistoryPage']

export interface HistoryQuery {
  path?: string
  filter?: string
  before?: string | null
  limit?: number
}

export type AuditEntry = Schemas['AuditEntry']
export type AuditPage = Schemas['AuditPage']

export interface AuditFilter {
  path: string
  actor: string
  action: string
}

export interface NewUser {
  username: string
  password: string
  role: string
}
