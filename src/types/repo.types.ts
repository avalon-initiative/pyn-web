import type { Schemas } from '../api/schema'

export type Branch = Schemas['Branch']
export type ActivePolicy = Schemas['ActivePolicy']
export type BranchComparison = Schemas['BranchComparison']
export type HistoryPage = Schemas['HistoryPage']
export type Tag = Schemas['Tag']
export type CreateTagRequest = Schemas['CreateTagRequest']

export interface HistoryQuery {
  path?: string
  filter?: string
  before?: string | null
  branch?: string
  limit?: number
  author?: string
  since?: string
}

export type AuditPage = Schemas['AuditPage']
