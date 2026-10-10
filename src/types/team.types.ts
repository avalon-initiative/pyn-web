import type { Schemas } from '../api/schema'

export type TeamRepo = Schemas['TeamRepo']
export type TeamInfo = Schemas['TeamInfo']
export type RepoTeam = Schemas['RepoTeam']

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

export type MemberSource = Schemas['Member']['source']
