export type RegistrationMode = 'open' | 'invite' | 'closed'

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
