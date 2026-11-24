import {
  matchesPullQuery,
  parsePullQuery,
  pullCounts,
  type PullCommit,
  type PullEvent,
  type PullRequest,
  type PullRequestSummary,
} from '@avalon-initiative/pyn-common-ui'
import type {
  ServerPull,
  ServerPullCommit,
  ServerPullEvent,
  ServerPullSummary,
} from '../types/pull.types'
import { canWrite } from './freeze.state'

export type PullStatus = 'open' | 'closed'
export const PULL_PAGE_SIZE = 25

// The server has no review state and counts changes only on the single pull request.
export const toPullSummary = (p: ServerPullSummary, href?: string): PullRequestSummary => ({
  number: p.number,
  title: p.title,
  state: p.state,
  author: p.author,
  base: p.base,
  head: p.head,
  opened_at: p.opened_at,
  closed_at: p.closed_at,
  merged_at: p.merged_at,
  merged_by: p.merged_by,
  comments: p.comments,
  review: 'none',
  additions: 0,
  deletions: 0,
  href,
})

export const toPull = (p: ServerPull): PullRequest => ({
  ...toPullSummary(p),
  additions: p.additions,
  deletions: p.deletions,
  body: p.body,
  commits: p.commits,
  changed_files: p.changed_files,
  outcome: p.outcome ?? undefined,
  conflicts: p.conflicts,
  locks: p.locks,
  participants: p.participants,
})

export const toPullCommit = (c: ServerPullCommit): PullCommit => ({
  id: c.id,
  message: c.message,
  author: c.author,
  committed_at: c.committed_at,
})

export const toPullEvent = (e: ServerPullEvent): PullEvent => ({
  id: e.id,
  kind: e.kind,
  actor: e.actor,
  at: e.at,
  body: e.body ?? undefined,
})

/** The list tab a search selects: `is:closed` and `is:merged` pick Closed, anything else Open. */
export function pullStatus(query: string): PullStatus {
  const is = parsePullQuery(query).is
  return is === 'closed' || is === 'merged' ? 'closed' : 'open'
}

const withoutStatus = (query: string) =>
  query
    .trim()
    .split(/\s+/)
    .filter((w) => w && !/^is:/i.test(w))
    .join(' ')

/** The search with its `is:` qualifier set to the tab. */
export const withPullStatus = (query: string, status: PullStatus): string =>
  `is:${status} ${withoutStatus(query)}`.trim()

/** The rows the search and tab show, and the tab counts for the search without its `is:`. */
export function pullListView(all: PullRequestSummary[], query: string) {
  const status = pullStatus(query)
  const bare = withoutStatus(query)
  const counts = pullCounts(all.filter((p) => matchesPullQuery(p, bare)))
  const rows = all.filter(
    (p) =>
      matchesPullQuery(p, query) && (status === 'open' ? p.state === 'open' : p.state !== 'open'),
  )
  return { status, counts, rows }
}

/** What the viewer may do; merge and open need checkin, edit, close and reopen the author or checkin. */
export function pullAbilities(
  permissions: string[],
  me: string,
  author: string | undefined,
  frozen: boolean,
) {
  const checkin = permissions.includes('checkin')
  return {
    canMerge: canWrite(checkin, frozen),
    canManage: canWrite(checkin || (!!me && me === author), frozen),
    canComment: canWrite(!!me && permissions.includes('read'), frozen),
  }
}
