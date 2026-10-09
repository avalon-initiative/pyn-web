import type { RepoInfo } from '../types/repo.types'

export const PERMISSIONS = [
  'read',
  'lock',
  'checkin',
  'restore',
  'force_unlock',
  'edit_policy',
  'manage_users',
  'manage_roles',
  'view_audit',
] as const

export const AUDIT_ACTIONS = [
  'checkout',
  'release',
  'checkin',
  'restore',
  'force_unlock',
  'member_added',
  'role_changed',
  'role_permissions_changed',
  'token_created',
  'token_revoked',
  'repo_created',
  'repo_updated',
  'repo_deleted',
] as const

export const repoSlug = (r: { owner: string; name: string }) => `${r.owner}/${r.name}`

/** The app route of a repository page; `section` is empty for the files page. */
export function repoPath(r: { owner: string; name: string }, section = ''): string {
  const base = `/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.name)}`
  return section ? `${base}/${section}` : base
}

export interface RepoTab {
  section: string
  label: string
}

/** Tabs the viewer may use; the server enforces the same permissions. */
export function repoTabs(permissions: string[], isOwner: boolean): RepoTab[] {
  const has = (p: string) => permissions.includes(p)
  const tabs: RepoTab[] = [
    { section: '', label: 'Files' },
    { section: 'locks', label: 'Locks' },
    { section: 'history', label: 'History' },
  ]
  if (has('view_audit')) tabs.push({ section: 'audit', label: 'Audit' })
  if (has('manage_users')) tabs.push({ section: 'members', label: 'Members' })
  if (has('manage_roles')) tabs.push({ section: 'roles', label: 'Roles' })
  if (has('manage_users')) tabs.push({ section: 'invites', label: 'Invites' })
  if (isOwner && has('manage_roles')) tabs.push({ section: 'settings', label: 'Settings' })
  return tabs
}

export function sortRepos(repos: RepoInfo[]): RepoInfo[] {
  return [...repos].sort((a, b) => repoSlug(a).localeCompare(repoSlug(b)))
}
