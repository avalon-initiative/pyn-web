import type { Schemas } from '../api/schema'

export type Branch = Schemas['Branch']
export type HistoryPage = Schemas['HistoryPage']

export interface HistoryQuery {
  path?: string
  filter?: string
  before?: string | null
  branch?: string
  limit?: number
}

export type AuditPage = Schemas['AuditPage']
