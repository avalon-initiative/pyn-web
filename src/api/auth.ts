import { setCsrfToken } from '../state/csrf.state'
import type {
  RegisterForm,
  Registered,
  RegistrationInfo,
  Session,
  SetupForm,
  SetupStatus,
  SignInForm,
  SignInOptions,
} from '../types/auth.types'
import { ApiError } from './client'
import { api, call } from './http'

export const fetchRegistration = () => call<RegistrationInfo>(api.GET('/v1/registration'))

/** The server sets the HttpOnly session cookie; the page only keeps the CSRF token. */
export async function signIn(form: SignInForm): Promise<Session> {
  const session = await call<Session>(api.POST('/v1/session', { body: form }))
  setCsrfToken(session.csrf_token)
  return session
}

/** The session the browser's cookie already holds, or null when signed out. */
export async function restoreSession(): Promise<Session | null> {
  try {
    const session = await call<Session>(api.GET('/v1/session'))
    setCsrfToken(session.csrf_token)
    return session
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null
    throw e
  }
}

export const register = (form: RegisterForm) =>
  call<Registered>(
    api.POST('/v1/register', {
      body: { ...form, email: form.email || null, invite: form.invite || null },
    }),
  )

export const verifyEmail = (token: string) =>
  call<Registered>(api.POST('/v1/register/verify', { body: { token } }))

export const resendVerification = (email: string) =>
  call<void>(api.POST('/v1/register/resend', { body: { email } }))

/** Ends the session on the server; the caller forgets it either way. */
export async function signOut(): Promise<void> {
  try {
    await call<void>(api.DELETE('/v1/session'))
  } finally {
    setCsrfToken('')
  }
}

export const fetchSetupStatus = () => call<SetupStatus>(api.GET('/v1/setup'))

export const completeSetup = (form: SetupForm) =>
  call<{ user: string }>(
    api.POST('/v1/setup', {
      body: {
        token: form.token.trim(),
        username: form.username,
        password: form.password,
        email: form.email || null,
        server_name: form.server_name || null,
        public_url: form.public_url || null,
        registration: form.registration,
      },
    }),
  )

export const fetchSignInOptions = () => call<SignInOptions>(api.GET('/v1/sign-in-options'))
