import type { OrgInfo, OrgMember } from '../types/org.types'

export const orgs: OrgInfo[] = [
  { name: 'studio', created_at: '2026-09-02T08:00:00Z', role: 'owner' },
  { name: 'modding-club', created_at: '2026-09-20T12:30:00Z', role: 'member' },
]

export const orgMembers: OrgMember[] = [
  { user: 'alice', role: 'owner' },
  { user: 'bob', role: 'member' },
  { user: 'carol', role: 'member' },
]
