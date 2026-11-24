import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { AccountDeletionStatus } from '../api/account-deletion'
import type { PynBranchCompare } from '@avalon-initiative/pyn-common-ui'
import type { BranchSummary, LockInfo, OrgInfo } from '@avalon-initiative/pyn-common-ui'
import type { RepoInfo } from '@avalon-initiative/pyn-common-ui'

export interface SessionContext {
  user: Ref<string>
  /** Whether `GET /v1/me` reports a server administrator. */
  admin: Ref<boolean>
  /** Called when the server says the session is gone. */
  expire: () => void
  /** Asks a signed-out visitor to sign in; absent where there is no sign-in page. */
  requestSignIn?: () => void
  /** The effective deletion recovery window in days, once the shell has read it. */
  recoveryDays?: Ref<number | undefined>
  /** Called when the account's deletion has just been scheduled. */
  scheduled?: (status: AccountDeletionStatus) => void
}

export interface RepoContext {
  target: ComputedRef<{ owner: string; name: string }>
  repo: Ref<RepoInfo | null>
  permissions: Ref<string[]>
  /** The owning organization; null for a user-owned repository. */
  org: Ref<OrgInfo | null>
  /** Whether the owner is frozen: writes are refused. */
  frozen: Ref<boolean>
  /** Live locks, null until first read; the pages that read them keep it current. */
  locks: Ref<LockInfo[] | null>
  /** Every branch, newest first; ahead and behind only for the branch being compared. */
  branches: ComputedRef<BranchSummary[]>
  branchesLoading?: Ref<boolean>
  branchesError?: Ref<string>
  /** Switches the page to a branch through the address. */
  selectBranch?: (name: string) => unknown
  /** Rereads the branch list, e.g. after one was created, renamed or deleted. */
  reloadBranches?: () => Promise<void>
  /** The branch comparison; the landing page places it under its toolbar, other pages above their content. */
  compare?: {
    props: ComputedRef<Omit<InstanceType<typeof PynBranchCompare>['$props'], 'onSelect'>>
    show: ComputedRef<boolean>
    open: (path: string) => void
  }
  /** The repository's star count, undefined until it is read. */
  starCount?: ComputedRef<number | undefined>
  reload: () => Promise<void>
}

/** Opens the command palette, optionally with text typed in. */
export const paletteKey: InjectionKey<{ show: (initial?: string) => void }> = Symbol('palette')
export const sessionKey: InjectionKey<SessionContext> = Symbol('session')
export const repoKey: InjectionKey<RepoContext> = Symbol('repo')

export interface OrgContext {
  name: ComputedRef<string>
  /** Null while loading, and when the name is not an organization. */
  org: Ref<OrgInfo | null>
  frozen: Ref<boolean>
  reload: () => Promise<void>
}

export const orgKey: InjectionKey<OrgContext> = Symbol('org')
