import type { Schemas } from '../api/schema'

export type TokenInfo = Schemas['TokenInfo']
export type CreatedToken = Schemas['CreatedToken']

export interface TokenForm {
  name: string
  repos: string[]
  permissions: string[]
  expires_at: string | null
}
