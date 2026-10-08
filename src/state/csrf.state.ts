let csrfToken = ''

export function setCsrfToken(token: string): void {
  csrfToken = token
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

/** The CSRF header the server requires on state-changing requests made with the session cookie. */
export function csrfHeaders(method: string): Record<string, string> {
  return csrfToken && !SAFE.has(method.toUpperCase()) ? { 'X-Pyn-CSRF': csrfToken } : {}
}
