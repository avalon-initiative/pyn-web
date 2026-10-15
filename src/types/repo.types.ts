import type { Schemas } from '../api/schema'

export type HistoryPage = Schemas['HistoryPage']

export interface HistoryQuery {
  path?: string
  filter?: string
  before?: string | null
  limit?: number
}

export type AuditPage = Schemas['AuditPage']
