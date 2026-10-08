const TOKEN_PREFIX = 'pyn_'
const TOKEN_KEY = 'pyn.token'
const USER_KEY = 'pyn.user'

/** A pasted API token, as opposed to a development user name. */
export function isToken(credential: string): boolean {
  return credential.startsWith(TOKEN_PREFIX)
}

export function authHeaders(credential: string): Record<string, string> {
  if (!credential) return {}
  return isToken(credential)
    ? { Authorization: `Bearer ${credential}` }
    : { 'X-Pyn-User': credential }
}

/** Tokens live only for the browser session; a dev name is remembered across sessions. */
export function loadCredential(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(USER_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveCredential(credential: string): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    if (!credential) return
    if (isToken(credential)) sessionStorage.setItem(TOKEN_KEY, credential)
    else localStorage.setItem(USER_KEY, credential)
  } catch {
    // Storage is optional; the credential just resets on reload.
  }
}
