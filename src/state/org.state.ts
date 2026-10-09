import type { OrgInfo, OrgMember, OrgRole } from '../types/org.types'

export const ORG_ROLES: OrgRole[] = ['member', 'owner']

/** The app route of an organization page; `section` is empty for the profile. */
export function orgPath(name: string, section = ''): string {
  const base = `/${encodeURIComponent(name)}`
  return section ? `${base}/-/${section}` : base
}

export const sortOrgs = (orgs: OrgInfo[]): OrgInfo[] =>
  [...orgs].sort((a, b) => a.name.localeCompare(b.name))

export const isOrgOwner = (org: { role?: OrgRole | null } | null) => org?.role === 'owner'

export interface OrgTab {
  section: string
  label: string
}

/** Tabs the viewer may use; the server enforces the same rules. */
export function orgTabs(role: OrgRole | null | undefined): OrgTab[] {
  const tabs: OrgTab[] = [{ section: '', label: 'Repositories' }]
  if (role) tabs.push({ section: 'members', label: 'Members' })
  if (role === 'owner')
    tabs.push({ section: 'audit', label: 'Audit' }, { section: 'settings', label: 'Settings' })
  return tabs
}

/** Who may own a new repository: the user, then the organizations they own. */
export function ownerChoices(user: string, orgs: OrgInfo[]): string[] {
  return [user, ...sortOrgs(orgs.filter(isOrgOwner)).map((o) => o.name)]
}

/** Owners remove anyone; anyone may remove themselves (leave). */
export function canRemove(m: OrgMember, self: string, viewerIsOwner: boolean): boolean {
  return viewerIsOwner || m.user === self
}
