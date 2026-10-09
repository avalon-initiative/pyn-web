export type AdminAccountStatus = 'pending_verification' | 'pending_approval' | 'active' | 'disabled'

/** Mirrors the server's `AccountInfo`. */
export interface AccountInfo {
  user: string
  email?: string | null
  email_verified: boolean
  status: AdminAccountStatus
  disabled_at?: string | null
  disabled_reason?: string | null
  admin: boolean
  created_at: string
}

/** Mirrors the server's `Account` (`GET /v1/me`). */
export interface AccountMe {
  user: string
  admin?: boolean
}

export interface DisableRequest {
  user: string
  reason: string
}
