import type { Schemas } from '../api/schema'

export type OrgMember = Schemas['OrgMember']
export type OrgRole = OrgMember['role']

/** The server types `role` as a plain string; it is `owner` or `member`. */
export type OrgInfo = Omit<Schemas['OrgInfo'], 'role'> & { role?: OrgRole | null }

export interface NewOrgMember {
  user: string
  role: OrgRole
}

export type CreationRule = Schemas['CreationRuleInfo']
export type RepoPolicy = Schemas['RepoPolicyInfo']
export type MemberCreation = RepoPolicy['member_creation']
export type RuleEffect = CreationRule['effect']
export type RuleKind = CreationRule['kind']
export type RuleScope = CreationRule['scope']

/** Identifies one rule: a subject holds at most one per effect. */
export type RuleRef = Pick<CreationRule, 'effect' | 'kind' | 'subject'>
