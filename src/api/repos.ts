import type { FileRow, LockInfo, MyLock } from '@avalon-initiative/pyn-common-ui'
import type { FileEntry, FilePage, Me } from '../types/lock.types'
import type { CheckinBody, CheckinResult, PolicyPreview } from '../types/policy.types'
import type { InviteInfo, Member, RoleGrant } from '@avalon-initiative/pyn-common-ui'
import type { AuditPage, BranchComparison, HistoryPage, HistoryQuery } from '../types/repo.types'
import {
  type AuditFilter,
  type FetchedContent,
  type NewUser,
  type RepoSettings,
  type RepoSummary,
  type TreeListing,
} from '@avalon-initiative/pyn-common-ui'
import type {
  ActivePolicy,
  Branch,
  RepoDetails,
  UpdateRepoRequest,
  WatchedRepo,
} from '../types/repo.types'
import type { Registered } from '../types/auth.types'
import { api, binaryBody, call } from './http'
import type { Schemas } from './schema'

type Role = Schemas['Role']

type Repo = { owner: string; name: string }

const at = (r: Repo) => ({ params: { path: r } })
const blank = (v: string | null | undefined) => v || undefined

export const listRepos = (owner?: string) =>
  call<RepoDetails[]>(api.GET('/v1/repos', { params: { query: { owner: blank(owner) } } }))

export const exploreRepos = (query: { after?: string; limit?: number } = {}) =>
  call<Schemas['RepoPage']>(api.GET('/v1/explore/repos', { params: { query } }))

export const createRepo = (owner: string, s: RepoSettings, starterPolicy?: boolean) =>
  call<RepoDetails>(
    api.POST('/v1/repos', {
      body: {
        owner,
        ...s,
        max_locks_per_user: s.max_locks_per_user ?? undefined,
        starter_policy: starterPolicy,
      },
    }),
  )

export const getRepo = (r: Repo) => call<RepoDetails>(api.GET('/v1/repos/{owner}/{name}', at(r)))

export const putStar = (r: Repo) =>
  call<Schemas['StarState']>(api.PUT('/v1/repos/{owner}/{name}/star', at(r)))

export const deleteStar = (r: Repo) =>
  call<Schemas['StarState']>(api.DELETE('/v1/repos/{owner}/{name}/star', at(r)))

export const putWatch = (r: Repo, level: Schemas['WatchLevel']) =>
  call<Schemas['WatchState']>(
    api.PUT('/v1/repos/{owner}/{name}/watch', { ...at(r), body: { level } }),
  )

export const deleteWatch = (r: Repo) =>
  call<Schemas['WatchState']>(api.DELETE('/v1/repos/{owner}/{name}/watch', at(r)))

export const listWatching = () => call<WatchedRepo[]>(api.GET('/v1/me/watching'))

export const listForks = (r: Repo) =>
  call<RepoDetails[]>(api.GET('/v1/repos/{owner}/{name}/forks', at(r)))

export const forkRepo = (r: Repo, body: Schemas['ForkRepoRequest']) =>
  call<RepoDetails>(api.POST('/v1/repos/{owner}/{name}/forks', { ...at(r), body }))

export const updateRepo = (r: Repo, s: UpdateRepoRequest) =>
  call<RepoDetails>(api.PATCH('/v1/repos/{owner}/{name}', { ...at(r), body: s }))

export const uploadRepoIcon = (r: Repo, file: File) =>
  call<RepoDetails>(
    api.PUT('/v1/repos/{owner}/{name}/icon', { ...at(r), ...binaryBody(file, file.type) }),
  )

export const removeRepoIcon = (r: Repo) =>
  call<RepoDetails>(api.DELETE('/v1/repos/{owner}/{name}/icon', at(r)))

export const deleteRepo = (r: Repo) => call<void>(api.DELETE('/v1/repos/{owner}/{name}', at(r)))

export const repoMe = (r: Repo) => call<Me>(api.GET('/v1/repos/{owner}/{name}/me', at(r)))

export const listBranches = (r: Repo) =>
  call<Branch[]>(api.GET('/v1/repos/{owner}/{name}/branches', at(r)))

export const createBranch = (r: Repo, name: string, start?: string) =>
  call<Branch>(api.POST('/v1/repos/{owner}/{name}/branches', { ...at(r), body: { name, start } }))

export const renameBranch = (r: Repo, branch: string, name: string) =>
  call<Branch>(
    api.PATCH('/v1/repos/{owner}/{name}/branches/{branch}', {
      params: { path: { ...r, branch } },
      body: { name },
    }),
  )

export const deleteBranch = (r: Repo, branch: string, force = false) =>
  call<void>(
    api.DELETE('/v1/repos/{owner}/{name}/branches/{branch}', {
      params: { path: { ...r, branch }, query: { force: force || undefined } },
    }),
  )

export const fetchPolicy = (r: Repo, paths: string[] = []) =>
  call<ActivePolicy>(
    api.GET('/v1/repos/{owner}/{name}/policy', { params: { path: r, query: { path: paths } } }),
  )

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

export const fetchTree = (r: Repo, path = '', branch?: string) =>
  call<TreeListing>(
    api.GET('/v1/repos/{owner}/{name}/tree', {
      params: { path: r, query: { path: blank(path), branch: blank(branch) } },
    }),
  )

export const fetchSummary = (r: Repo, activity = 6, branch?: string) =>
  call<RepoSummary>(
    api.GET('/v1/repos/{owner}/{name}/summary', {
      params: { path: r, query: { activity, branch: blank(branch) } },
    }),
  )

export const compareBranch = (r: Repo, head: string) =>
  call<BranchComparison>(
    api.GET('/v1/repos/{owner}/{name}/compare', { params: { path: r, query: { head } } }),
  )

/** Reads at most `limit` bytes of a file's head content, then stops the download. */
export async function fetchContent(
  r: Repo,
  path: string,
  limit: number,
  revision?: number,
  branch?: string,
): Promise<FetchedContent> {
  const { data } = await api.GET('/v1/repos/{owner}/{name}/content', {
    params: { path: r, query: { path, revision, branch: blank(branch) } },
    parseAs: 'stream',
  })
  const reader = data?.getReader()
  if (!reader) return { bytes: new Uint8Array(), truncated: false }
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

/** The head entry of one path, or null when the branch has none; `after` is the path with its last character dropped. */
export async function fetchFileEntry(r: Repo, path: string): Promise<FileEntry | null> {
  const page = await call<FilePage>(
    api.GET('/v1/repos/{owner}/{name}/files', {
      params: { path: r, query: { after: path.slice(0, -1), limit: 1 } },
    }),
  )
  return page.entries.find((e) => e.path === path) ?? null
}

/** Uploads the text (as UTF-8) as an object and returns its blob id. */
export async function putObject(r: Repo, text: string): Promise<string> {
  const { content } = await call<{ content: string }>(
    api.PUT('/v1/repos/{owner}/{name}/objects', {
      ...at(r),
      ...binaryBody(new TextEncoder().encode(text), 'application/octet-stream'),
    }),
  )
  return content
}

export const checkin = (r: Repo, body: CheckinBody) =>
  call<CheckinResult>(api.POST('/v1/repos/{owner}/{name}/checkin', { ...at(r), body }))

export const previewPolicy = (r: Repo, content: string) =>
  call<PolicyPreview>(
    api.POST('/v1/repos/{owner}/{name}/policy/preview', { ...at(r), body: { content } }),
  )

export const listLocks = (r: Repo) =>
  call<LockInfo[]>(api.GET('/v1/repos/{owner}/{name}/locks', at(r)))

export const listMyLocks = () => call<MyLock[]>(api.GET('/v1/me/locks'))

export const checkout = (r: Repo, path: string, baseRevision?: number | null) =>
  call<LockInfo>(
    api.POST('/v1/repos/{owner}/{name}/checkout', {
      ...at(r),
      body: { path, ...(baseRevision == null ? {} : { base_revision: baseRevision }) },
    }),
  )

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
          branch: blank(q.branch),
          limit: q.limit,
          author: q.author ? [q.author] : undefined,
          since: blank(q.since),
        },
      },
    }),
  )

export const historyAuthors = (r: Repo, branch?: string) =>
  call<Schemas['HistoryAuthors']>(
    api.GET('/v1/repos/{owner}/{name}/history/authors', {
      params: { path: r, query: { branch: blank(branch) } },
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
      body: { role: role as Role },
    }),
  )

export const addUser = (r: Repo, u: NewUser) =>
  call<Registered>(
    api.POST('/v1/repos/{owner}/{name}/users', { ...at(r), body: { ...u, role: u.role as Role } }),
  )

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
    api.POST('/v1/repos/{owner}/{name}/invites', { ...at(r), body: { role: role as Role, hours } }),
  )

export const revokeInvite = (r: Repo, id: string) =>
  call<void>(
    api.DELETE('/v1/repos/{owner}/{name}/invites/{id}', { params: { path: { ...r, id } } }),
  )
