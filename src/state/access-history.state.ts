import { onMounted, ref } from 'vue'
import type { AccessSessionInfo } from '@avalon-initiative/pyn-common-ui'
import { ApiError, describeError } from '../api/client'
import { fetchOwnAccessSessions } from '../api/access-sessions'
import { ownAccessSessions } from './access-session.state'

/** The account's access-session history; unlike the banner, a failure is shown. */
export function useOwnAccessHistory(
  read: () => Promise<AccessSessionInfo[]> = fetchOwnAccessSessions,
) {
  const sessions = ref<AccessSessionInfo[]>([])
  const error = ref('')
  const loaded = ref(false)
  onMounted(async () => {
    try {
      sessions.value = await read()
      ownAccessSessions.value = sessions.value
      loaded.value = true
    } catch (e) {
      // An older server has no such route: nothing to show.
      if (!(e instanceof ApiError && e.status === 404 && e.code === 'not_found'))
        error.value = describeError(e)
    }
  })
  return { sessions, error, loaded }
}
