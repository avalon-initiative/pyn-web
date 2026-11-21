import { computed, onUnmounted, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQuery } from 'vue-router'
import type { BranchOption } from '@avalon-initiative/pyn-common-ui'
import type { Branch } from '../types/repo.types'
import { describeError } from '../api/client'

const REFRESH_MS = 15_000

/** The branch named in an address; undefined means the default branch. */
export function branchParam(query: LocationQuery): string | undefined {
  const v = Array.isArray(query.branch) ? query.branch[0] : query.branch
  return v || undefined
}

export function useBranch(): ComputedRef<string | undefined> {
  const route = useRoute()
  return computed(() => branchParam(route.query))
}

/** The repository's branches, kept in step with the address's `branch` query parameter. */
export function useBranches(
  target: Ref<{ owner: string; name: string }>,
  read: (t: { owner: string; name: string }) => Promise<Branch[]>,
) {
  const route = useRoute()
  const router = useRouter()
  const branch = useBranch()
  const branches = ref<Branch[]>([])
  const loaded = ref(false)
  const loading = ref(true)
  const error = ref('')

  const defaultName = computed(() => branches.value.find((b) => b.default)?.name ?? '')
  const current = computed(() => branch.value ?? defaultName.value)
  const options = computed<BranchOption[]>(() =>
    branches.value.map((b) => ({ name: b.name, isDefault: b.default })),
  )
  const unknown = computed(
    () => loaded.value && !!branch.value && !branches.value.some((b) => b.name === branch.value),
  )
  const pending = computed(() => !!branch.value && !loaded.value && !error.value)

  async function load() {
    const t = target.value
    try {
      const list = await read(t)
      if (t !== target.value) return
      branches.value = list
      loaded.value = true
      error.value = ''
    } catch (e) {
      if (t !== target.value) return
      error.value = describeError(e)
    } finally {
      if (t === target.value) loading.value = false
    }
  }

  function select(name: string) {
    const query = { ...route.query }
    if (name === defaultName.value) delete query.branch
    else query.branch = name
    return router.push({ query })
  }

  watch(
    target,
    () => {
      branches.value = []
      loaded.value = false
      loading.value = true
      load()
    },
    { immediate: true },
  )
  const timer = setInterval(load, REFRESH_MS)
  onUnmounted(() => clearInterval(timer))

  return { branches, options, current, unknown, pending, loading, error, select }
}
