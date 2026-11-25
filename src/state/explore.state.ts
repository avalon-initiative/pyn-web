import { ref } from 'vue'
import { exploreRepos } from '../api/repos'
import { ApiError, describeError } from '../api/client'
import type { RepoDetails } from '../types/repo.types'

/** Paging over the public repository list; `refused` is set when the server wants a sign-in for it. */
export function useExplore(pageSize = 30) {
  const repos = ref<RepoDetails[]>([])
  const next = ref<string | null>(null)
  const loaded = ref(false)
  const busy = ref(false)
  const error = ref('')
  const refused = ref(false)

  async function load(append: boolean) {
    busy.value = true
    error.value = ''
    try {
      const page = await exploreRepos({
        after: append ? (next.value ?? undefined) : undefined,
        limit: pageSize,
      })
      repos.value = append ? [...repos.value, ...page.repos] : page.repos
      next.value = page.next_after ?? null
      loaded.value = true
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) refused.value = true
      else error.value = describeError(e)
    } finally {
      busy.value = false
    }
  }

  return {
    repos,
    next,
    loaded,
    busy,
    error,
    refused,
    load: () => load(false),
    more: () => (next.value ? load(true) : Promise.resolve()),
  }
}
