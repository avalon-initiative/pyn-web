import { navItems } from '@avalon-initiative/pyn-common-ui'
import type { NavItem } from '@avalon-initiative/pyn-common-ui'

/** The sidebar item that matches the current route path, if any. */
export function activeNav(path: string): string {
  if (path === '/') return 'home'
  if (path === '/_/locks') return 'locks'
  if (path === '/_/orgs') return 'orgs'
  if (path === '/_/admin/webhooks') return 'webhooks'
  return path === '/_/admin/accounts' ? 'accounts' : ''
}

/** The library's sidebar items plus the Webhooks page for administrators. */
export const sideNavItems = (admin: boolean): NavItem[] => [
  ...navItems(admin),
  ...(admin
    ? [{ id: 'webhooks', label: 'Webhooks', href: '/_/admin/webhooks', icon: 'settings' }]
    : []),
]
