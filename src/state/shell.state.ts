export interface NavItem {
  id: string
  label: string
  href: string
  icon: string
}

export const mainNav: NavItem[] = [
  { id: 'home', label: 'Home', href: '/', icon: 'home' },
  { id: 'locks', label: 'Your locks', href: '/_/locks', icon: 'lock' },
  { id: 'orgs', label: 'Organizations', href: '/_/orgs', icon: 'user' },
]

const adminNav: NavItem = {
  id: 'accounts',
  label: 'Accounts',
  href: '/_/admin/accounts',
  icon: 'user',
}

/** The sidebar items; server administration shows only for administrators. */
export const navItems = (admin: boolean): NavItem[] => (admin ? [...mainNav, adminNav] : mainNav)

export const accountNav = [{ id: 'keys', label: 'SSH keys', href: '/_/settings/keys' }]

/** The sidebar item that matches the current route path, if any. */
export function activeNav(path: string): string {
  if (path === '/') return 'home'
  if (path === '/_/locks') return 'locks'
  if (path === '/_/orgs') return 'orgs'
  return path === adminNav.href ? adminNav.id : ''
}

/** Which repositories match what the user typed, by owner/name substring. */
export function matchRepos(slugs: string[], query: string): string[] {
  const q = query.trim().toLowerCase()
  return q ? slugs.filter((s) => s.toLowerCase().includes(q)) : []
}
