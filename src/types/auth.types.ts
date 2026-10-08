export type RegistrationMode = 'open' | 'invite' | 'closed'

/** Mirrors the server's `CreatedToken`. */
export interface CreatedToken {
  token: string
  info: { id: string; user: string; expires_at: string | null }
}

export interface SignInForm {
  username: string
  password: string
}

export interface RegisterForm extends SignInForm {
  invite?: string
}
