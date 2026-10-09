import { inject, ref } from 'vue'
import { ApiError, describeError } from '../api/client'
import { sessionKey } from './context.state'

/** Busy flag and error text around a user-triggered request. */
export function useAction() {
  const session = inject(sessionKey)
  const busy = ref(false)
  const error = ref('')

  async function attempt(action: () => Promise<void>): Promise<boolean> {
    busy.value = true
    error.value = ''
    try {
      await action()
      return true
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) session?.expire()
      error.value = describeError(e)
      return false
    } finally {
      busy.value = false
    }
  }

  return { busy, error, attempt }
}
