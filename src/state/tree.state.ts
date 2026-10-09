import { repoPath } from './repo.state'
import type { ActivityEntry, Crumb } from '../types/tree.types'

type Repo = { owner: string; name: string }

const encodeSegments = (path: string) => path.split('/').map(encodeURIComponent).join('/')

/** The app route of a folder; the root is the repository's Code tab. */
export function treePath(r: Repo, path: string): string {
  const clean = path.replace(/^\/+|\/+$/g, '')
  return clean ? repoPath(r, `tree/${encodeSegments(clean)}`) : repoPath(r)
}

/** The repository name, then one crumb per folder; the last is the current location. */
export function breadcrumbs(r: Repo, path: string): Crumb[] {
  const parts = path.split('/').filter(Boolean)
  const crumbs: Crumb[] = [{ label: r.name, href: parts.length ? treePath(r, '') : undefined }]
  parts.forEach((label, i) => {
    const last = i === parts.length - 1
    crumbs.push({ label, href: last ? undefined : treePath(r, parts.slice(0, i + 1).join('/')) })
  })
  return crumbs
}

/** The folder a route's `path` param names, always without slashes at the ends. */
export function folderParam(param: string | string[] | undefined): string {
  const raw = Array.isArray(param) ? param.join('/') : (param ?? '')
  return raw.replace(/^\/+|\/+$/g, '')
}

const UNITS: [string, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
]

/** "2 hours ago", "just now"; absolute date beyond a month. */
export function formatAgo(iso: string, now: Date): string {
  const ms = now.getTime() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  if (ms >= 30 * 86_400_000) return iso.slice(0, 10)
  for (const [unit, size] of UNITS) {
    if (ms >= size) {
      const n = Math.floor(ms / size)
      return `${n} ${unit}${n === 1 ? '' : 's'} ago`
    }
  }
  return 'just now'
}

const VERBS: Record<string, string> = {
  checkout: 'locked',
  release: 'released',
  checkin: 'checked in',
  restore: 'restored',
  force_unlock: 'force-unlocked',
}

export const activityVerb = (e: ActivityEntry) => VERBS[e.action] ?? e.action
