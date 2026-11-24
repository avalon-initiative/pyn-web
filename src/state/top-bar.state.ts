import { computed, ref } from 'vue'
import { orgPath } from '@avalon-initiative/pyn-common-ui'
import type { BellEntry, NavItem, OrgInfo, OwnerOption } from '@avalon-initiative/pyn-common-ui'
import { acceptInvitation, declineInvitation } from '../api/orgs'
import { listMyLocks } from '../api/repos'
import { dismissNotice, listNotices } from '../api/two-factor'
import type { Notice } from '../types/two-factor.types'
import { myInvitations } from './invitations.state'
import { refreshInvitations, refreshOrgs, refreshRepos } from './session-data.state'
import { SECURITY_PATH } from './two-factor.state'
import type { AccountMenuItem } from '../types/extension.types'

const HOUR_MS = 3_600_000

const locksHeld = ref(0)
const locksExpiring = ref(false)
const notices = ref<Notice[]>([])
const busyEntries = ref<string[]>([])

const NOTICE = 'notice:'
const INVITATION = 'invitation:'

/** Security notices and pending invitations as bell entries, newest first. */
export const bellEntries = computed<BellEntry[]>(() =>
  [
    ...notices.value.map((n) => ({
      id: NOTICE + n.id,
      title: n.detail,
      at: n.created_at,
      href: n.kind === 'two_factor_reset' ? SECURITY_PATH : undefined,
      kind: 'notice' as const,
      busy: busyEntries.value.includes(NOTICE + n.id),
    })),
    ...myInvitations.value.map((i) => ({
      id: INVITATION + i.org,
      title: `${i.invited_by} invited you to ${i.org} as ${i.role}`,
      at: i.created_at,
      href: '/_/invitations',
      kind: 'invitation' as const,
      busy: busyEntries.value.includes(INVITATION + i.org),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)),
)

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
    notices.value = await listNotices()
  } catch {
    notices.value = []
  }
}

/** Loads the lock and notice counts; invitations come from the session refresh. */
export const loadTopBar = () => Promise.all([refreshLocks(Date.now()), refreshNotices()])

/** Reloads every count; call it after an action that changes them. */
export const refreshTopBar = () => Promise.all([loadTopBar(), refreshInvitations()])

export function resetTopBar() {
  locksHeld.value = 0
  locksExpiring.value = false
  notices.value = []
  busyEntries.value = []
}

async function answer(id: string, action: () => Promise<void>) {
  busyEntries.value = [...busyEntries.value, id]
  try {
    await action()
  } catch {
    // the lists reload below, so a gone or refused entry disappears
  } finally {
    busyEntries.value = busyEntries.value.filter((b) => b !== id)
    await refreshTopBar()
  }
}

/** Handlers for the bell's dismiss, accept and decline events; `go` opens a path. */
export function bellActions(go: (path: string) => unknown) {
  const org = (id: string) => id.slice(INVITATION.length)
  return {
    dismiss: (id: string) => answer(id, () => dismissNotice(id.slice(NOTICE.length))),
    accept: (id: string) =>
      answer(id, async () => {
        await acceptInvitation(org(id))
        void Promise.all([refreshOrgs(), refreshRepos()])
        await go(orgPath(org(id)))
      }),
    decline: (id: string) => answer(id, () => declineInvitation(org(id))),
  }
}

export const useTopBar = () => ({ locksHeld, locksExpiring, bellEntries })

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
