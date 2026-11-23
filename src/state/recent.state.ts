import { ref } from 'vue'
import type { RecentItem } from '@avalon-initiative/pyn-common-ui'
import type { RouteLocationNormalized } from 'vue-router'
import { orgPath, repoPath } from '@avalon-initiative/pyn-common-ui'
import { sessionOrgs } from './session-data.state'

export const RECENT_MAX = 10
const KEY = 'pyn.recent.'
const KINDS = ['repository', 'organization', 'person', 'file']

/** The signed-in user's recently opened pages, newest first. */
export const recentItems = ref<RecentItem[]>([])
let user = ''
let pending: RecentItem[] = []

const valid = (i: unknown): i is RecentItem =>
  !!i &&
  typeof i === 'object' &&
  typeof (i as RecentItem).label === 'string' &&
  typeof (i as RecentItem).href === 'string' &&
  KINDS.includes((i as RecentItem).kind)

function read(name: string): RecentItem[] {
  try {
    const items: unknown = JSON.parse(localStorage.getItem(KEY + name) ?? '[]')
    return Array.isArray(items) ? items.filter(valid).slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

function write() {
  try {
    localStorage.setItem(KEY + user, JSON.stringify(recentItems.value))
  } catch {
    // storage unavailable: the list only lasts for this page load
  }
}

function add(list: RecentItem[], item: RecentItem) {
  return [item, ...list.filter((i) => i.href !== item.href)].slice(0, RECENT_MAX)
}

/** Switches to a user's list; pages opened before the name was known are added to it. */
export function setRecentUser(name: string) {
  if (name === user) return
  user = name
  recentItems.value = name ? read(name) : []
  if (name) {
    for (const item of pending.reverse()) recentItems.value = add(recentItems.value, item)
    if (pending.length) write()
  }
  pending = []
}

export function recordRecent(item: RecentItem) {
  if (!user) {
    pending = add(pending, item)
    return
  }
  recentItems.value = add(recentItems.value, item)
  write()
}

export function clearRecent() {
  recentItems.value = []
  if (!user) return
  try {
    localStorage.removeItem(KEY + user)
  } catch {
    // storage unavailable: nothing was kept
  }
}

/** The item a successful navigation opened, or null for pages that are not worth returning to. */
export function recentFor(
  to: Pick<RouteLocationNormalized, 'params' | 'path'> & { name?: string | symbol | null },
): RecentItem | null {
  const owner = String(to.params.owner ?? '')
  if (!owner || to.name === 'not-found') return null
  const name = String(to.params.name ?? '')
  if (name) {
    if (to.name === 'blob') {
      const path = [to.params.path].flat().join('/')
      return { label: `${owner}/${name}: ${path}`, href: to.path, kind: 'file' }
    }
    return { label: `${owner}/${name}`, href: repoPath({ owner, name }), kind: 'repository' }
  }
  const org = sessionOrgs.value.some((o) => o.name === owner)
  return { label: owner, href: orgPath(owner), kind: org ? 'organization' : 'person' }
}
