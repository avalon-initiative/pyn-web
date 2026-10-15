import type { Schemas } from '../api/schema'

export type RepoInfo = Schemas['RepoInfo']
export type Visibility = Schemas['Visibility']

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
