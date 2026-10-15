/** The sidebar item that matches the current route path, if any. */
export function activeNav(path: string): string {
  if (path === '/') return 'home'
  if (path === '/_/locks') return 'locks'
  if (path === '/_/orgs') return 'orgs'
  return path === '/_/admin/accounts' ? 'accounts' : ''
}
