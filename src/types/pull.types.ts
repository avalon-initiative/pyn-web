import type { Schemas } from '../api/schema'

export type ServerPullSummary = Schemas['PullRequestSummary']
export type ServerPull = Schemas['PullRequest']
export type ServerPullPage = Schemas['PullRequestPage']
export type ServerPullCommit = Schemas['PullCommit']
export type ServerPullEvent = Schemas['PullEvent']
export type ServerRepoDiff = Schemas['RepoDiff']
export type ServerDiffFile = Schemas['DiffFile']
export type ServerDiffHunk = Schemas['DiffHunk']
export type ServerDiffLine = Schemas['DiffLine']
export type FileLines = Schemas['FileLines']
export type NewPull = Schemas['CreatePullRequest']
export type PullUpdate = Schemas['UpdatePullRequest']
export type PullMerge = Schemas['MergePullRequest']
export type PullComment = Schemas['CommentPullRequest']

export interface PullListQuery {
  state?: Schemas['PullRequestState']
  base?: string
  head?: string
  author?: string
  before?: number
  limit?: number
}

export interface DiffQuery {
  base?: string
  head: string
  merge_base?: boolean
}
