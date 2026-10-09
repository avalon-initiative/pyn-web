export interface NavItem {
  id: string
  label: string
  href: string
  icon: string
}

export const mainNav: NavItem[] = [
  { id: 'home', label: 'Home', href: '/', icon: 'home' },
  { id: 'repositories', label: 'Repositories', href: '/_/repos', icon: 'repo' },
  { id: 'settings', label: 'Settings', href: '/_/keys', icon: 'settings' },
]

/** The sidebar item that matches the current route path, if any. */
export function activeNav(path: string): string {
  if (path === '/') return 'home'
  if (path === '/_/repos') return 'repositories'
  return path.startsWith('/_/keys') ? 'settings' : ''
}

/** Which repositories match what the user typed, by owner/name substring. */
export function matchRepos(slugs: string[], query: string): string[] {
  const q = query.trim().toLowerCase()
  return q ? slugs.filter((s) => s.toLowerCase().includes(q)) : []
}
