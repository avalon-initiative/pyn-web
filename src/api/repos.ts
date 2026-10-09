import type { FilePage, FileRow, LockInfo, Me, MyLock } from '../types/lock.types'
import type {
  AuditFilter,
  AuditPage,
  HistoryPage,
  HistoryQuery,
  InviteInfo,
  Member,
  NewUser,
  RepoInfo,
  RepoSettings,
  RoleGrant,
} from '../types/repo.types'
import type { RepoSummary, TreeListing } from '../types/tree.types'
import { contentUrl } from '../state/blob.state'
import type { FetchedContent } from '../types/blob.types'
import { failure, send } from './auth'

type Repo = { owner: string; name: string }

const base = (r: Repo) => `/v1/repos/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.name)}`

function query(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const listRepos = (owner?: string) => send<RepoInfo[]>('GET', `/v1/repos${query({ owner })}`)

export const createRepo = (owner: string, s: RepoSettings) =>
  send<RepoInfo>('POST', '/v1/repos', {
    owner,
    ...s,
    max_locks_per_user: s.max_locks_per_user ?? undefined,
  })

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

/** Reads at most `limit` bytes of a file's head content, then stops the download. */
export async function fetchContent(r: Repo, path: string, limit: number): Promise<FetchedContent> {
  const res = await fetch(contentUrl(r, path))
  if (!res.ok) throw await failure(res)
  const reader = res.body?.getReader()
  if (!reader) return { bytes: new Uint8Array(await res.arrayBuffer()), truncated: false }
  const chunks: Uint8Array[] = []
  let size = 0
  while (size <= limit) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.length
  }
  const truncated = size > limit
  if (truncated) await reader.cancel()
  const bytes = new Uint8Array(Math.min(size, limit))
  let at = 0
  for (const c of chunks) {
    const part = c.subarray(0, bytes.length - at)
    bytes.set(part, at)
    at += part.length
  }
  return { bytes, truncated }
}

export const listLocks = (r: Repo) => send<LockInfo[]>('GET', `${base(r)}/locks`)

export const listMyLocks = () => send<MyLock[]>('GET', '/v1/me/locks')

export const releaseLock = (r: Repo, path: string) =>
  send<void>('POST', `${base(r)}/release`, { path })

export const forceUnlock = (r: Repo, path: string, reason: string) =>
  send<LockInfo>('POST', `${base(r)}/force-unlock`, { path, reason })

export const fetchHistory = (r: Repo, q: HistoryQuery = {}) =>
  send<HistoryPage>('GET', `${base(r)}/history${query({ ...q })}`)

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
