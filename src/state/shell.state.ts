import { navItems } from '@avalon-initiative/pyn-common-ui'
import { activeExtraNav } from './extension.state'
import type { NavItem } from '@avalon-initiative/pyn-common-ui'

/** The sidebar item that matches the current route path, if any. */
export function activeNav(path: string, extra: NavItem[] = []): string {
  if (path === '/') return 'home'
  if (path === '/_/locks') return 'locks'
  if (path === '/_/orgs') return 'orgs'
  if (path === '/_/invitations') return 'invitations'
  if (path === '/_/admin/webhooks') return 'webhooks'
  if (path === '/_/admin/accounts') return 'accounts'
  return activeExtraNav(path, extra)
}

/** The library's sidebar items, Invitations, the Webhooks page for administrators, then the build-time extras. */
export const sideNavItems = (admin: boolean, extra: NavItem[] = []): NavItem[] => [
  ...navItems(admin),
  { id: 'invitations', label: 'Invitations', href: '/_/invitations', icon: 'user' },
  ...(admin
    ? [{ id: 'webhooks', label: 'Webhooks', href: '/_/admin/webhooks', icon: 'settings' }]
    : []),
  ...extra,
]
