import { ref } from 'vue'
import { sortOrgs } from '@avalon-initiative/pyn-common-ui'
import type { OrgInfo, RepoInfo } from '@avalon-initiative/pyn-common-ui'
import { listMyInvitations, listMyOrgs } from '../api/orgs'
import { listRepos } from '../api/repos'
import { clearOwnAccessSessions, refreshOwnAccessSessions } from './access-session.state'
import { pendingInvitations } from './invitations.state'
import { sortRepos } from './repo.state'

export const SESSION_FAST_MS = 60_000
export const SESSION_SLOW_MS = 300_000

// Session-level lists the shell shows; views refresh the one their action changed.
export const sessionRepos = ref<RepoInfo[]>([])
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
    pendingInvitations.value = (await listMyInvitations()).length
  } catch {
    pendingInvitations.value = 0
  }
}

export const refreshSlow = () => Promise.all([refreshRepos(), refreshOrgs(), refreshInvitations()])
export const refreshAllSession = () => Promise.all([refreshOwnAccessSessions(), refreshSlow()])

export function clearSessionData() {
  sessionRepos.value = []
  sessionOrgs.value = []
  pendingInvitations.value = 0
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
