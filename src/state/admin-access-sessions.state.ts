import { ref } from 'vue'
import type {
  AccessSessionInfo,
  AccessSessionStart,
  StartedAccessSession,
} from '@avalon-initiative/pyn-common-ui'
import { endAccessSession, listAccessSessions, startAccessSession } from '../api/access-sessions'
import { refreshOwnAccessSessions } from './access-session.state'
import { useAction } from './action.state'

/** The administrator's session list and start/end actions; the secret is held until dismissed. */
export function useAccessSessions() {
  const sessions = ref<AccessSessionInfo[]>([])
  const started = ref<StartedAccessSession | null>(null)
  const { busy, error, attempt } = useAction()

  const refresh = async () => {
    sessions.value = await listAccessSessions()
  }
  return {
    sessions,
    started,
    busy,
    error,
    load: () => attempt(refresh),
    start: (user: string, r: AccessSessionStart) =>
      attempt(async () => {
        started.value = await startAccessSession(user, r)
        void refreshOwnAccessSessions()
        await refresh()
      }),
    end: (id: string) =>
      attempt(async () => {
        await endAccessSession(id)
        void refreshOwnAccessSessions()
        await refresh()
      }),
    dismiss: () => (started.value = null),
  }
}
