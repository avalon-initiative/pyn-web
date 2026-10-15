import type { FileRow, LockInfo, MyLock } from '@avalon-initiative/pyn-common-ui'
import type { FilePage, Me } from '../types/lock.types'
import type { InviteInfo, Member, RepoInfo, RoleGrant } from '@avalon-initiative/pyn-common-ui'
import type { AuditPage, HistoryPage, HistoryQuery } from '../types/repo.types'
import {
  type AuditFilter,
  type FetchedContent,
  type NewUser,
  type RepoSettings,
  type RepoSummary,
  type TreeListing,
  contentUrl,
} from '@avalon-initiative/pyn-common-ui'
import type { Registered } from '../types/auth.types'
import { api, call, failure } from './http'

type Repo = { owner: string; name: string }

const at = (r: Repo) => ({ params: { path: r } })
const blank = (v: string | null | undefined) => v || undefined

export const listRepos = (owner?: string) =>
  call<RepoInfo[]>(api.GET('/v1/repos', { params: { query: { owner: blank(owner) } } }))

export const createRepo = (owner: string, s: RepoSettings) =>
  call<RepoInfo>(
    api.POST('/v1/repos', {
      body: { owner, ...s, max_locks_per_user: s.max_locks_per_user ?? undefined },
    }),
  )

export const getRepo = (r: Repo) => call<RepoInfo>(api.GET('/v1/repos/{owner}/{name}', at(r)))

export const updateRepo = (r: Repo, s: Partial<RepoSettings>) =>
  call<RepoInfo>(api.PATCH('/v1/repos/{owner}/{name}', { ...at(r), body: s }))

export const deleteRepo = (r: Repo) => call<void>(api.DELETE('/v1/repos/{owner}/{name}', at(r)))

export const repoMe = (r: Repo) => call<Me>(api.GET('/v1/repos/{owner}/{name}/me', at(r)))

export async function fetchFiles(r: Repo): Promise<FileRow[]> {
  const rows: FileRow[] = []
  let after: string | undefined
  do {
    const page: FilePage = await call(
      api.GET('/v1/repos/{owner}/{name}/files', { params: { path: r, query: { after } } }),
    )
    rows.push(...page.entries)
    after = page.next_after ?? undefined
  } while (after)
  return rows
}

export const fetchTree = (r: Repo, path = '') =>
  call<TreeListing>(
    api.GET('/v1/repos/{owner}/{name}/tree', {
      params: { path: r, query: { path: blank(path) } },
    }),
  )

export const fetchSummary = (r: Repo, activity = 6) =>
  call<RepoSummary>(
    api.GET('/v1/repos/{owner}/{name}/summary', { params: { path: r, query: { activity } } }),
  )

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

export const listLocks = (r: Repo) =>
  call<LockInfo[]>(api.GET('/v1/repos/{owner}/{name}/locks', at(r)))

export const listMyLocks = () => call<MyLock[]>(api.GET('/v1/me/locks'))

export const releaseLock = (r: Repo, path: string) =>
  call<void>(api.POST('/v1/repos/{owner}/{name}/release', { ...at(r), body: { path } }))

export const forceUnlock = (r: Repo, path: string, reason: string) =>
  call<LockInfo>(
    api.POST('/v1/repos/{owner}/{name}/force-unlock', { ...at(r), body: { path, reason } }),
  )

export const fetchHistory = (r: Repo, q: HistoryQuery = {}) =>
  call<HistoryPage>(
    api.GET('/v1/repos/{owner}/{name}/history', {
      params: {
        path: r,
        query: {
          path: blank(q.path),
          filter: blank(q.filter),
          before: blank(q.before),
          limit: q.limit,
        },
      },
    }),
  )

export const listAudit = (r: Repo, f: Partial<AuditFilter>, before?: number) =>
  call<AuditPage>(
    api.GET('/v1/repos/{owner}/{name}/audit', {
      params: {
        path: r,
        query: { path: blank(f.path), actor: blank(f.actor), action: blank(f.action), before },
      },
    }),
  )

export const listMembers = (r: Repo) =>
  call<Member[]>(api.GET('/v1/repos/{owner}/{name}/members', at(r)))

export const setMember = (r: Repo, user: string, role: string) =>
  call<void>(
    api.PUT('/v1/repos/{owner}/{name}/members/{user}', {
      params: { path: { ...r, user } },
      body: { role },
    }),
  )

export const addUser = (r: Repo, u: NewUser) =>
  call<Registered>(api.POST('/v1/repos/{owner}/{name}/users', { ...at(r), body: u }))

export const listRoles = (r: Repo) =>
  call<RoleGrant[]>(api.GET('/v1/repos/{owner}/{name}/roles', at(r)))

export const setRole = (r: Repo, role: string, permissions: string[]) =>
  call<void>(
    api.PUT('/v1/repos/{owner}/{name}/roles/{role}', {
      params: { path: { ...r, role } },
      body: { permissions },
    }),
  )

export const listInvites = (r: Repo) =>
  call<InviteInfo[]>(api.GET('/v1/repos/{owner}/{name}/invites', at(r)))

export const createInvite = (r: Repo, role: string, hours: number) =>
  call<{ code: string; info: InviteInfo }>(
    api.POST('/v1/repos/{owner}/{name}/invites', { ...at(r), body: { role, hours } }),
  )

export const revokeInvite = (r: Repo, id: string) =>
  call<void>(
    api.DELETE('/v1/repos/{owner}/{name}/invites/{id}', { params: { path: { ...r, id } } }),
  )
