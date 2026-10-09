export type Visibility = 'public' | 'private'

/** Mirrors the server's `RepoInfo`. */
export interface RepoInfo {
  owner: string
  name: string
  visibility: Visibility
  lease_hours: number
  /** Effective lock limit per user. */
  max_locks_per_user: number
  /** The stored setting alone; absent or null follows the server default. */
  max_locks_per_user_setting?: number | null
  /** True when the policy file sets the limit and the setting cannot change. */
  max_locks_set_by_policy: boolean
  created_at: string
  /** The caller's role; absent when the server does not report one. */
  role?: string | null
}

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

/** Mirrors the server's `Member`. */
export interface Member {
  user: string
  /** The effective role. */
  role: string
  /** What decides the role. */
  source: 'direct' | 'team' | 'org_owner'
}

/** Mirrors the server's `RoleGrant`. */
export interface RoleGrant {
  role: string
  permissions: string[]
}

/** Mirrors the server's `InviteInfo`. */
export interface InviteInfo {
  id: string
  role: string
  created_by: string
  created_at: string
  expires_at: string
  revoked_at?: string | null
  used_at?: string | null
  used_by?: string | null
}

/** Mirrors the server's `Revision`, without the content. */
export interface Revision {
  id: number
  path: string
  author: string
  message: string
  created_at: string
  restored_from?: number | null
}

/** Mirrors the server's `HistoryPage`. */
export interface HistoryPage {
  revisions: Revision[]
  next_cursor: string | null
}

export interface HistoryQuery {
  path?: string
  filter?: string
  before?: string | null
  limit?: number
}

/** Mirrors the server's `AuditEntry`. */
export interface AuditEntry {
  id: number
  at: string
  actor: string
  action: string
  detail: string
  path?: string | null
}

export interface AuditPage {
  entries: AuditEntry[]
  next_before: number | null
}

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
