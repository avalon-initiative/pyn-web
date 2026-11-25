import { ref } from 'vue'
import { sortOrgs } from '@avalon-initiative/pyn-common-ui'
import type { OrgInfo } from '@avalon-initiative/pyn-common-ui'
import { listMyInvitations, listMyOrgs } from '../api/orgs'
import { listRepos } from '../api/repos'
import { clearOwnAccessSessions, refreshOwnAccessSessions } from './access-session.state'
import { myInvitations } from './invitations.state'
import { sortRepos } from './repo.state'
import type { RepoDetails } from '../types/repo.types'

export const SESSION_FAST_MS = 60_000
export const SESSION_SLOW_MS = 300_000

// Session-level lists the shell shows; views refresh the one their action changed.
export const sessionRepos = ref<RepoDetails[]>([])
export const sessionOrgs = ref<OrgInfo[]>([])

export async function refreshRepos() {
  try {
    sessionRepos.value = sortRepos(await listRepos())
  } catch {
    // keep the last list
  }
}

export async function refreshOrgs() {
  try {
    sessionOrgs.value = sortOrgs(await listMyOrgs())
  } catch {
    // keep the last list
  }
}

export async function refreshInvitations() {
  try {
    myInvitations.value = await listMyInvitations()
  } catch {
    myInvitations.value = []
  }
}

export const refreshSlow = () => Promise.all([refreshRepos(), refreshOrgs(), refreshInvitations()])
export const refreshAllSession = () => Promise.all([refreshOwnAccessSessions(), refreshSlow()])

export function clearSessionData() {
  sessionRepos.value = []
  sessionOrgs.value = []
  myInvitations.value = []
  clearOwnAccessSessions()
}

/** Loads everything once, then refreshes on window focus and on timers; returns the stop function. */
export function startSessionRefresh(): () => void {
  void refreshAllSession()
  const onFocus = () => void refreshAllSession()
  const fast = setInterval(() => void refreshOwnAccessSessions(), SESSION_FAST_MS)
  const slow = setInterval(() => void refreshSlow(), SESSION_SLOW_MS)
  window.addEventListener('focus', onFocus)
  return () => {
    clearInterval(fast)
    clearInterval(slow)
    window.removeEventListener('focus', onFocus)
  }
}
