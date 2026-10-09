/** Mirrors the server's `TeamRepo`. */
export interface TeamRepo {
  /** `owner/name`. */
  repo: string
  role: string
}

/** Mirrors the server's `TeamInfo`. */
export interface TeamInfo {
  slug: string
  name: string
  description: string
  created_at: string
  members: string[]
  repos: TeamRepo[]
}

/** Mirrors the server's `RepoTeam`. */
export interface RepoTeam {
  slug: string
  name: string
  description: string
  role: string
}

/** What the team form emits; `slug` is only present when creating. */
export interface TeamFormValue {
  slug?: string
  name: string
  description: string
}

/** One row of a role list, whether the grantee is a person or a team. */
export interface Grantee {
  name: string
  role: string
  /** Absent for a team; otherwise where the role comes from. */
  source?: MemberSource
  href?: string
}

export type MemberSource = 'direct' | 'team' | 'org_owner'
