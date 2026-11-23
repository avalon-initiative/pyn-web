const KEY = 'pyn.remembered-user'

/** The username remembered on this browser; a display convenience, never a credential. */
export function rememberedUser(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

/** Remembers the username, or forgets it when `remember` is false. */
export function rememberUser(name: string, remember: boolean) {
  try {
    if (remember) localStorage.setItem(KEY, name)
    else localStorage.removeItem(KEY)
  } catch {
    // storage unavailable: nothing is remembered
  }
}
