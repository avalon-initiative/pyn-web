import type { Schemas } from '../api/schema'

export type RegistrationInfo = Schemas['RegistrationInfo']
export type RegistrationMode = RegistrationInfo['registration']

export type AccountStatus = Schemas['Registered']['status']

/** What stops an account from signing in. */
export type BlockedStatus = Exclude<AccountStatus, 'active' | 'disabled'> | 'account_disabled'

export type Registered = Schemas['Registered']
export type Session = Schemas['SessionInfo']

export interface SignInForm {
  username: string
  password: string
}

export interface RegisterForm extends SignInForm {
  email?: string
  invite?: string
}

export type SshKey = Schemas['SshKeyInfo']

export type VerifyOutcome = 'verifying' | 'verified' | 'invalid'

export type SetupStatus = Schemas['SetupStatus']

export interface SetupForm {
  token: string
  username: string
  password: string
  email: string
  server_name: string
  public_url: string
  registration: RegistrationMode
}

export type SignInOptions = Schemas['SignInOptions']
export type ExternalProvider = Schemas['ExternalProviderInfo']
