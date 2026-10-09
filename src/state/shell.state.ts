export interface NavItem {
  id: string
  label: string
  href: string
  icon: string
}

export const mainNav: NavItem[] = [{ id: 'home', label: 'Home', href: '/', icon: 'home' }]

export const accountNav = [{ id: 'keys', label: 'SSH keys', href: '/_/settings/keys' }]

/** The sidebar item that matches the current route path, if any. */
export function activeNav(path: string): string {
  return path === '/' ? 'home' : ''
}

/** Which repositories match what the user typed, by owner/name substring. */
export function matchRepos(slugs: string[], query: string): string[] {
  const q = query.trim().toLowerCase()
  return q ? slugs.filter((s) => s.toLowerCase().includes(q)) : []
}
