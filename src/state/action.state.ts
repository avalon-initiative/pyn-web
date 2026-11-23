import { inject, ref } from 'vue'
import { ApiError, describeError } from '../api/client'
import { sessionKey } from './context.state'
import { withFreshCheck } from './fresh.state'

/** Busy flag and error text around a user-triggered request. */
/** A request whose 401 means a wrong password or code, not an ended session, passes `false`; `describe` words its errors. */
export function useAction(expiring = true, describe: (e: unknown) => string = describeError) {
  const session = inject(sessionKey)
  const busy = ref(false)
  const error = ref('')

  async function attempt(action: () => Promise<void>): Promise<boolean> {
    busy.value = true
    error.value = ''
    try {
      await withFreshCheck(action)
      return true
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && expiring) session?.expire()
      error.value = describe(e)
      return false
    } finally {
      busy.value = false
    }
  }

  return { busy, error, attempt }
}
