import { ref } from 'vue'
import type { AccessSessionInfo } from '@avalon-initiative/pyn-common-ui'
import { fetchOwnAccessSessions } from '../api/access-sessions'

// Held at module level so the shell banner and the security page read one list.
const own = ref<AccessSessionInfo[]>([])

/** The account's own access sessions for the banner: any failure or an older server shows nothing. */
export const ownAccessSessions = own

export async function refreshOwnAccessSessions(
  read: () => Promise<AccessSessionInfo[]> = fetchOwnAccessSessions,
) {
  own.value = await read().catch(() => [])
}

export const clearOwnAccessSessions = () => (own.value = [])
