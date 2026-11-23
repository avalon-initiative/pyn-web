import { ref } from 'vue'
import type { Ref } from 'vue'
import { ApiError, describeError } from '../api/client'

export interface Card<T> {
  data: Ref<T>
  loading: Ref<boolean>
  error: Ref<string>
  load: () => Promise<void>
}

/** One dashboard card's request: its own loading and error state, so one failure leaves the rest. */
export function useCard<T>(fetch: () => Promise<T>, initial: T, onExpired?: () => void): Card<T> {
  const data = ref(initial) as Ref<T>
  const loading = ref(true)
  const error = ref('')
  async function load() {
    error.value = ''
    try {
      data.value = await fetch()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onExpired?.()
      error.value = describeError(e)
    } finally {
      loading.value = false
    }
  }
  return { data, loading, error, load }
}
