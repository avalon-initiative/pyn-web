import { ref } from 'vue'
import { ApiError } from '../api/client'

export const FRESH_CHECK_REQUIRED = 'fresh_check_required'

/** The open second-factor prompt, if any; the shell renders it and settles it. */
export const freshPrompt = ref<{ settle: (passed: boolean) => void } | null>(null)

/** Asks for a second factor; resolves true once the check passed, false when it was cancelled. */
export function requestFresh(): Promise<boolean> {
  freshPrompt.value?.settle(false)
  return new Promise((resolve) => {
    freshPrompt.value = {
      settle: (passed) => {
        freshPrompt.value = null
        resolve(passed)
      },
    }
  })
}

/** Runs `action`; on `fresh_check_required` asks for a second factor and repeats it once. */
export async function withFreshCheck<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (e) {
    if (!(e instanceof ApiError) || e.code !== FRESH_CHECK_REQUIRED) throw e
    if (!(await requestFresh())) throw e
    return action()
  }
}
