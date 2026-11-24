import { orgPath } from '@avalon-initiative/pyn-common-ui'
import type { Crumb } from '@avalon-initiative/pyn-common-ui'
import type { LocationQuery, RouteMeta, RouteParams } from 'vue-router'

interface Where {
  name?: string | symbol | null
  params: RouteParams
  query: LocationQuery
  meta: RouteMeta
}

const HOME: Crumb = { label: 'Home', href: '/' }

const SETTINGS: Record<string, string> = {
  'profile-settings': 'Profile',
  emails: 'Email addresses',
  username: 'Username',
  password: 'Password',
  security: 'Security',
  keys: 'SSH keys',
  tokens: 'Access tokens',
  identities: 'Linked sign-in',
  'delete-account': 'Delete account',
}

const ADMIN: Record<string, string> = {
  'admin-accounts': 'Accounts',
  'admin-invitations': 'Invitations',
  'admin-access': 'Server access',
  'admin-two-factor': 'Two-factor',
  'admin-access-sessions': 'Access sessions',
  'admin-audit': 'Audit log',
  'admin-webhooks': 'Webhooks',
}

const ORG: Record<string, string> = {
  'owner-usage': 'Usage',
  'org-members': 'Members',
  'org-teams': 'Teams',
  'org-audit': 'Audit log',
  'org-settings': 'Settings',
  'org-settings-members': 'Members',
  'org-settings-teams': 'Teams',
  'org-settings-usage': 'Usage',
  'org-settings-audit': 'Audit log',
}

const PERSONAL: Record<string, string> = {
  'my-locks': 'Your locks',
  explore: 'Explore',
  people: 'People',
  orgs: 'Organizations',
  invitations: 'Invitations',
  'new-repo': 'New repository',
  'new-org': 'New organization',
}

// Repository pages show the shell's owner / repo title instead of a trail.
const REPO_PAGES = new Set([
  'files',
  'tree',
  'blob',
  'locks',
  'branches',
  'history',
  'policy',
  'settings',
  'settings-members',
  'settings-roles',
  'settings-invites',
  'settings-policy',
  'settings-storage',
  'settings-audit',
])

const text = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join('/') : (v ?? ''))

/** The trail above a page, from the route name and params; empty on repository pages. */
export function breadcrumbs(to: Where): Crumb[] {
  const name = String(to.name ?? '')
  const owner = text(to.params.owner)
  const last = (label: string): Crumb => ({ label })
  const area = (href: string, label: string): Crumb[] => [HOME, { label, href }]

  if (name in PERSONAL) return [HOME, last(PERSONAL[name])]
  if (name in SETTINGS) return [...area('/_/settings/profile', 'Settings'), last(SETTINGS[name])]
  if (name in ADMIN) return [...area('/_/admin/accounts', 'Administration'), last(ADMIN[name])]

  if (name === 'owner') return [HOME, last(owner)]
  if (name in ORG || name === 'org-team') {
    const trail = [HOME, { label: owner, href: orgPath(owner) }]
    if (name.startsWith('org-settings-')) {
      return [...trail, { label: 'Settings', href: orgPath(owner, 'settings') }, last(ORG[name])]
    }
    if (name !== 'org-team') return [...trail, last(ORG[name])]
    return [...trail, { label: 'Teams', href: orgPath(owner, 'teams') }, last(text(to.params.team))]
  }

  if (REPO_PAGES.has(name)) return []

  const crumb = to.meta.crumb
  return typeof crumb === 'string' ? [HOME, last(crumb)] : []
}
