import { computed, ref } from 'vue'
import type { MenuItem } from '@avalon-initiative/pyn-common-ui'
import { useAction } from './action.state'

export type WatchLevel = 'all' | 'locks' | 'ignore'
type WatchState = { level: WatchLevel | null; watchers: number }

const levels: { id: WatchLevel; label: string }[] = [
  { id: 'all', label: 'All activity' },
  { id: 'locks', label: 'Locks only' },
  { id: 'ignore', label: 'Ignore' },
]

// The server counts only `all` and `locks` as watchers.
const counted = (level: WatchLevel | null) => level === 'all' || level === 'locks'

/** Optimistic watch level for one repository; a failed request restores the previous state. */
export function useRepoWatch(
  signedOut: () => boolean,
  requestSignIn: (() => void) | undefined,
  calls: {
    put: (level: WatchLevel) => Promise<WatchState>
    remove: () => Promise<WatchState>
  },
) {
  const known = ref(false)
  const level = ref<WatchLevel | null>(null)
  const count = ref(0)
  const { busy, error, attempt } = useAction()

  function sync(info: { watching?: WatchLevel | null; watcher_count?: number } | null) {
    known.value = !!info
    level.value = info?.watching ?? null
    count.value = info?.watcher_count ?? 0
  }

  async function set(next: WatchLevel | null) {
    if (signedOut()) return requestSignIn?.()
    if (busy.value || !known.value || next === level.value) return
    const before = { level: level.value, count: count.value }
    level.value = next
    count.value = Math.max(0, before.count + Number(counted(next)) - Number(counted(before.level)))
    const ok = await attempt(async () => {
      const state = await (next ? calls.put(next) : calls.remove())
      level.value = state.level
      count.value = state.watchers
    })
    if (!ok) {
      level.value = before.level
      count.value = before.count
    }
  }

  const toggle = () => set(counted(level.value) ? null : 'all')
  const choose = (id: string) =>
    set(id === 'unwatch' ? null : (levels.find((l) => l.id === id)?.id ?? level.value))

  const menu = computed<MenuItem[]>(() => [
    ...levels.map((l) => ({ ...l, checked: level.value === l.id })),
    ...(level.value
      ? [
          { id: 'sep', label: '', separator: true },
          { id: 'unwatch', label: 'Unwatch' },
        ]
      : []),
  ])
  const button = computed(() =>
    known.value
      ? {
          count: count.value,
          active: counted(level.value),
          disabled: busy.value,
          menu: menu.value,
        }
      : undefined,
  )
  const watcherCount = computed(() => (known.value ? count.value : undefined))

  return { sync, toggle, choose, button, watcherCount, error }
}
