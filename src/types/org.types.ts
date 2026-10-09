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

export type MemberCreation = 'none' | 'private' | 'both'
export type RuleEffect = 'allow' | 'deny'
export type RuleKind = 'team' | 'user' | 'role'
export type RuleScope = 'public' | 'private' | 'both'

/** Mirrors the server's `CreationRuleInfo`. */
export interface CreationRule {
  effect: RuleEffect
  kind: RuleKind
  subject: string
  scope: RuleScope
}

/** Mirrors the server's `RepoPolicyInfo`. */
export interface RepoPolicy {
  member_creation: MemberCreation
  rules: CreationRule[]
}

/** Identifies one rule: a subject holds at most one per effect. */
export type RuleRef = Pick<CreationRule, 'effect' | 'kind' | 'subject'>
