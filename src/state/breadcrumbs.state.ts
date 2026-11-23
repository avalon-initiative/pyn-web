import { orgPath, repoPath, repoSettingsPath, treePath } from '@avalon-initiative/pyn-common-ui'
import type { Crumb } from '@avalon-initiative/pyn-common-ui'
import type { LocationQuery, RouteMeta, RouteParams } from 'vue-router'
import { branchParam } from './branch.state'

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
}

const PERSONAL: Record<string, string> = {
  'my-locks': 'Your locks',
  people: 'People',
  orgs: 'Organizations',
  invitations: 'Invitations',
  'new-repo': 'New repository',
  'new-org': 'New organization',
}

const REPO: Record<string, string> = {
  locks: 'Locks',
  history: 'History',
}

const REPO_SETTINGS: Record<string, string> = {
  'settings-members': 'Members',
  'settings-roles': 'Roles',
  'settings-invites': 'Invitations',
  'settings-policy': 'Policy',
  'settings-storage': 'Storage',
  'settings-audit': 'Audit log',
}

const text = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join('/') : (v ?? ''))

/** The trail above a page, built from the route name and params; labels are plain text. */
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
    if (name !== 'org-team') return [...trail, last(ORG[name])]
    return [...trail, { label: 'Teams', href: orgPath(owner, 'teams') }, last(text(to.params.team))]
  }

  const repo = { owner, name: text(to.params.name) }
  const branch = branchParam(to.query)
  const base: Crumb[] = [
    HOME,
    { label: owner, href: `/${encodeURIComponent(owner)}` },
    { label: repo.name, href: repoPath(repo, '', branch) },
  ]
  if (name === 'files') return [...base, last('Code')]
  if (name === 'tree' || name === 'blob') {
    const parts = text(to.params.path).split('/').filter(Boolean)
    const trail = parts.map((label, i) => {
      if (i === parts.length - 1) return last(label)
      return { label, href: treePath(repo, parts.slice(0, i + 1).join('/'), branch) }
    })
    return [...base, { label: 'Code', href: treePath(repo, '', branch) }, ...trail]
  }
  if (name in REPO) return [...base, last(REPO[name])]
  if (name === 'settings') return [...base, last('Settings')]
  if (name in REPO_SETTINGS) {
    const settings = { label: 'Settings', href: repoSettingsPath(repo, 'settings') }
    return [...base, settings, last(REPO_SETTINGS[name])]
  }

  const crumb = to.meta.crumb
  return typeof crumb === 'string' ? [HOME, last(crumb)] : []
}
