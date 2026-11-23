import { computed, ref } from 'vue'
import type { NavItem, OrgInfo, OwnerOption } from '@avalon-initiative/pyn-common-ui'
import { listMyLocks } from '../api/repos'
import { listNotices } from '../api/two-factor'
import { pendingInvitations } from './invitations.state'
import { refreshInvitations } from './session-data.state'
import type { AccountMenuItem } from '../types/extension.types'

const HOUR_MS = 3_600_000

const locksHeld = ref(0)
const locksExpiring = ref(false)
const notices = ref(0)
const notifications = computed(() => pendingInvitations.value + notices.value)

async function refreshLocks(now: number) {
  try {
    const locks = await listMyLocks()
    locksHeld.value = locks.length
    locksExpiring.value = locks.some((l) => Date.parse(l.expires_at) - now < HOUR_MS)
  } catch {
    locksHeld.value = 0
    locksExpiring.value = false
  }
}

async function refreshNotices() {
  try {
    notices.value = (await listNotices()).length
  } catch {
    notices.value = 0
  }
}

/** Loads the lock and notice counts; invitations come from the session refresh. */
export const loadTopBar = () => Promise.all([refreshLocks(Date.now()), refreshNotices()])

/** Reloads every count; call it after an action that changes them. */
export const refreshTopBar = () => Promise.all([loadTopBar(), refreshInvitations()])

export function resetTopBar() {
  locksHeld.value = 0
  locksExpiring.value = false
  notices.value = 0
}

export const useTopBar = () => ({ locksHeld, locksExpiring, notifications })

/** The person first, then their organizations. */
export const topBarOwners = (user: string, orgs: OrgInfo[]): OwnerOption[] => [
  { name: user, kind: 'user' },
  ...orgs.map((o): OwnerOption => ({ name: o.name, kind: 'org' })),
]

/** Destinations the side navigation used to offer, plus the build-time nav items, as account-menu entries. */
export const topBarExtras = (
  navItems: NavItem[],
  accountItems: AccountMenuItem[],
): AccountMenuItem[] => [
  { id: 'my-locks', label: 'Your locks', href: '/_/locks' },
  { id: 'orgs', label: 'Your organizations', href: '/_/orgs' },
  { id: 'people', label: 'People', href: '/_/people' },
  ...navItems.map((i) => ({ id: i.id, label: i.label, href: i.href })),
  ...accountItems,
]
