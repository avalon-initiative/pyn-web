export type RegistrationMode = 'open' | 'invite' | 'closed'

/** Mirrors the server's `RegistrationInfo`. */
export interface RegistrationInfo {
  registration: RegistrationMode
  email_verification: boolean
  approval: boolean
}

export type AccountStatus = 'active' | 'pending_verification' | 'pending_approval'

/** What stops an account from signing in. */
export type BlockedStatus = Exclude<AccountStatus, 'active'> | 'account_disabled'

/** Mirrors the server's `Registered`. */
export interface Registered {
  user: string
  status: AccountStatus
}

/** Mirrors the server's `SessionInfo`. */
export interface Session {
  user: string
  csrf_token: string
  expires_at: string
}

export interface SignInForm {
  username: string
  password: string
}

export interface RegisterForm extends SignInForm {
  email?: string
  invite?: string
}

/** Mirrors the server's `SshKeyInfo`. */
export interface SshKey {
  id: string
  title: string
  algorithm: string
  fingerprint: string
  created_at: string
  last_used_at: string | null
}

export type VerifyOutcome = 'verifying' | 'verified' | 'invalid'
