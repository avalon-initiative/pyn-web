import { computed, ref } from 'vue'
import { useAction } from './action.state'

/** Optimistic star state for one repository; a failed request restores the previous state. */
export function useRepoStar(
  signedOut: () => boolean,
  requestSignIn: (() => void) | undefined,
  calls: {
    put: () => Promise<{ starred: boolean; count: number }>
    remove: () => Promise<{ starred: boolean; count: number }>
  },
) {
  const known = ref(false)
  const starred = ref(false)
  const count = ref(0)
  const { busy, error, attempt } = useAction()

  function sync(info: { starred: boolean; star_count: number } | null) {
    known.value = !!info
    starred.value = info?.starred ?? false
    count.value = info?.star_count ?? 0
  }

  async function toggle() {
    if (signedOut()) return requestSignIn?.()
    if (busy.value || !known.value) return
    const before = { starred: starred.value, count: count.value }
    const adding = !before.starred
    starred.value = adding
    count.value = Math.max(0, before.count + (adding ? 1 : -1))
    const ok = await attempt(async () => {
      const state = await (adding ? calls.put() : calls.remove())
      starred.value = state.starred
      count.value = state.count
    })
    if (!ok) {
      starred.value = before.starred
      count.value = before.count
    }
  }

  const button = computed(() =>
    known.value ? { count: count.value, active: starred.value, disabled: busy.value } : undefined,
  )
  const starCount = computed(() => (known.value ? count.value : undefined))

  return { sync, toggle, button, starCount, error }
}
