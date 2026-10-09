import type { FilePage, FileRow, LockInfo, Me } from '../types/lock.types'
import type {
  AuditFilter,
  AuditPage,
  InviteInfo,
  Member,
  NewUser,
  RepoInfo,
  RepoSettings,
  Revision,
  RoleGrant,
} from '../types/repo.types'
import type { RepoSummary, TreeListing } from '../types/tree.types'
import { send } from './auth'

type Repo = { owner: string; name: string }

const base = (r: Repo) => `/v1/repos/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.name)}`

function query(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const listRepos = () => send<RepoInfo[]>('GET', '/v1/repos')

export const createRepo = (owner: string, s: RepoSettings) =>
  send<RepoInfo>('POST', '/v1/repos', { owner, ...s })

export const getRepo = (r: Repo) => send<RepoInfo>('GET', base(r))

export const updateRepo = (r: Repo, s: Partial<RepoSettings>) => send<RepoInfo>('PATCH', base(r), s)

export const deleteRepo = (r: Repo) => send<void>('DELETE', base(r))

export const repoMe = (r: Repo) => send<Me>('GET', `${base(r)}/me`)

export async function fetchFiles(r: Repo): Promise<FileRow[]> {
  const rows: FileRow[] = []
  let after: string | null = null
  do {
    const page: FilePage = await send('GET', `${base(r)}/files${query({ after })}`)
    rows.push(...page.entries)
    after = page.next_after
  } while (after)
  return rows
}

export const fetchTree = (r: Repo, path = '') =>
  send<TreeListing>('GET', `${base(r)}/tree${query({ path })}`)

export const fetchSummary = (r: Repo, activity = 6) =>
  send<RepoSummary>('GET', `${base(r)}/summary${query({ activity })}`)

export const listLocks = (r: Repo) => send<LockInfo[]>('GET', `${base(r)}/locks`)

export const forceUnlock = (r: Repo, path: string, reason: string) =>
  send<LockInfo>('POST', `${base(r)}/force-unlock`, { path, reason })

export const fileHistory = (r: Repo, path: string) =>
  send<Revision[]>('GET', `${base(r)}/history${query({ path })}`)

export const listAudit = (r: Repo, f: Partial<AuditFilter>, before?: number) =>
  send<AuditPage>('GET', `${base(r)}/audit${query({ ...f, before })}`)

export const listMembers = (r: Repo) => send<Member[]>('GET', `${base(r)}/members`)

export const setMember = (r: Repo, user: string, role: string) =>
  send<void>('PUT', `${base(r)}/members/${encodeURIComponent(user)}`, { role })

export const addUser = (r: Repo, u: NewUser) => send<void>('POST', `${base(r)}/users`, u)

export const listRoles = (r: Repo) => send<RoleGrant[]>('GET', `${base(r)}/roles`)

export const setRole = (r: Repo, role: string, permissions: string[]) =>
  send<void>('PUT', `${base(r)}/roles/${encodeURIComponent(role)}`, { permissions })

export const listInvites = (r: Repo) => send<InviteInfo[]>('GET', `${base(r)}/invites`)

export const createInvite = (r: Repo, role: string, hours: number) =>
  send<{ code: string; info: InviteInfo }>('POST', `${base(r)}/invites`, { role, hours })

export const revokeInvite = (r: Repo, id: string) =>
  send<void>('DELETE', `${base(r)}/invites/${encodeURIComponent(id)}`)
