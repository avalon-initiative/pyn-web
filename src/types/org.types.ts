export type OrgRole = 'owner' | 'member'

/** Mirrors the server's `OrgInfo`. */
export interface OrgInfo {
  name: string
  created_at: string
  /** The caller's standing; absent or null when they are not a member. */
  role?: OrgRole | null
}

/** Mirrors the server's `OrgMember`. */
export interface OrgMember {
  user: string
  role: OrgRole
}

export interface NewOrgMember {
  user: string
  role: OrgRole
}
