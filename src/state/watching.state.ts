import { repoSlug } from '@avalon-initiative/pyn-common-ui'
import type { RepoRef, WatchedRepoItem, WatchLevel } from '@avalon-initiative/pyn-common-ui'
import type { WatchedRepo } from '../types/repo.types'
import { repoRows } from './repo.state'

export const WATCHING_PATH = '/_/watching'

/** Rows of the Watching page; `busy` is the slug of the repository whose request runs. */
export const watchedItems = (list: WatchedRepo[], busy: string | null): WatchedRepoItem[] =>
  list.map((w) => ({
    repo: repoRows([w.repo])[0]!,
    level: w.level,
    busy: repoSlug(w.repo) === busy,
  }))

/** The list after the server answered `level` for `repo`; no level drops the row. */
export const withLevel = (list: WatchedRepo[], repo: RepoRef, level: WatchLevel | null) =>
  level
    ? list.map((w) => (repoSlug(w.repo) === repoSlug(repo) ? { ...w, level } : w))
    : list.filter((w) => repoSlug(w.repo) !== repoSlug(repo))
