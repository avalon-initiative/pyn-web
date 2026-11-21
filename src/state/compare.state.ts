import { onBeforeUnmount, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { BranchChange } from '@avalon-initiative/pyn-common-ui'
import type { BranchComparison } from '../types/repo.types'
import { describeError } from '../api/client'

type Target = { owner: string; name: string }

/** Compares a non-default branch with the default: on a branch change and on window focus, never on a timer. */
export function useBranchCompare(
  target: Ref<Target>,
  head: Ref<string | undefined>,
  read: (t: Target, head: string) => Promise<BranchComparison>,
) {
  const result = ref<BranchComparison | null>(null)
  const loading = ref(false)
  const error = ref('')

  async function load() {
    const t = target.value
    const h = head.value
    if (!h) return
    loading.value = result.value === null
    try {
      const r = await read(t, h)
      if (t !== target.value || h !== head.value) return
      result.value = r
      error.value = ''
    } catch (e) {
      if (t !== target.value || h !== head.value) return
      error.value = describeError(e)
    } finally {
      if (t === target.value && h === head.value) loading.value = false
    }
  }

  watch(
    [target, head],
    () => {
      result.value = null
      error.value = ''
      loading.value = false
      void load()
    },
    { immediate: true },
  )
  const onFocus = () => void load()
  window.addEventListener('focus', onFocus)
  onBeforeUnmount(() => window.removeEventListener('focus', onFocus))

  return { result, loading, error }
}

export const compareChanges = (r: BranchComparison): BranchChange[] =>
  r.changes.map((c) => ({ path: c.path, kind: c.kind }))
