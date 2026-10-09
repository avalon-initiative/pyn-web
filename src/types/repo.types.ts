export type Visibility = 'public' | 'private'

/** Mirrors the server's `RepoInfo`. */
export interface RepoInfo {
  owner: string
  name: string
  visibility: Visibility
  lease_hours: number
  created_at: string
  /** The caller's role; absent when the server does not report one. */
  role?: string | null
}

/** The fields of `CreateRepoRequest` and `UpdateRepoRequest` the UI sets. */
export interface RepoSettings {
  name: string
  visibility: Visibility
  lease_hours: number
}

/** Mirrors the server's `Member`. */
export interface Member {
  user: string
  role: string
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
