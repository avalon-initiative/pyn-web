import { authHeaders } from '../state/credential.state'
import type { CreatedToken, RegisterForm, RegistrationMode, SignInForm } from '../types/auth.types'
import { ApiError } from './client'

export async function send<T>(
  method: string,
  path: string,
  body?: unknown,
  credential = '',
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders(credential) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ code: 'error', message: `server returned ${res.status}` }))
    throw new ApiError(res.status, err.code, err.message)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export async function fetchRegistration(): Promise<RegistrationMode> {
  const info = await send<{ registration: RegistrationMode }>('GET', '/v1/registration')
  return info.registration
}

export function login(form: SignInForm): Promise<CreatedToken> {
  return send('POST', '/v1/login', form)
}

export async function register(form: RegisterForm): Promise<void> {
  await send('POST', '/v1/register', { ...form, invite: form.invite || null })
}

/** Ends the session on the server; the caller forgets it either way. */
export async function endSession(token: string, id: string): Promise<void> {
  await send('DELETE', `/v1/tokens/${id}`, undefined, token)
}
