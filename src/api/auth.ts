import { csrfHeaders, setCsrfToken } from '../state/csrf.state'
import type { RegisterForm, RegistrationMode, Session, SignInForm } from '../types/auth.types'
import { ApiError } from './client'

/** The `ApiError` for a non-2xx response, from the server's error body when it has one. */
export async function failure(res: Response): Promise<ApiError> {
  const err = await res
    .json()
    .catch(() => ({ code: 'error', message: `server returned ${res.status}` }))
  return new ApiError(res.status, err.code, err.message)
}

export async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...csrfHeaders(method) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw await failure(res)
  return res.status === 204 ? (undefined as T) : res.json()
}

export async function fetchRegistration(): Promise<RegistrationMode> {
  const info = await send<{ registration: RegistrationMode }>('GET', '/v1/registration')
  return info.registration
}

/** The server sets the HttpOnly session cookie; the page only keeps the CSRF token. */
export async function signIn(form: SignInForm): Promise<Session> {
  const session = await send<Session>('POST', '/v1/session', form)
  setCsrfToken(session.csrf_token)
  return session
}

/** The session the browser's cookie already holds, or null when signed out. */
export async function restoreSession(): Promise<Session | null> {
  try {
    const session = await send<Session>('GET', '/v1/session')
    setCsrfToken(session.csrf_token)
    return session
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null
    throw e
  }
}

export async function register(form: RegisterForm): Promise<void> {
  await send('POST', '/v1/register', { ...form, invite: form.invite || null })
}

/** Ends the session on the server; the caller forgets it either way. */
export async function signOut(): Promise<void> {
  try {
    await send('DELETE', '/v1/session')
  } finally {
    setCsrfToken('')
  }
}
