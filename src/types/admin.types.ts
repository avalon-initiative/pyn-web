import type { Schemas } from '../api/schema'

export type AccountInfo = Schemas['AccountInfo']
export type AdminAccountStatus = AccountInfo['status']

/** The account behind `GET /v1/me`. */
export type AccountMe = Schemas['Account']

export interface DisableRequest {
  user: string
  reason: string
}
