import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { OrgInfo } from '../types/org.types'
import type { RepoInfo } from '../types/repo.types'

export interface SessionContext {
  user: Ref<string>
  /** Whether `GET /v1/me` reports a server administrator. */
  admin: Ref<boolean>
  /** Called when the server says the session is gone. */
  expire: () => void
}

export interface RepoContext {
  target: ComputedRef<{ owner: string; name: string }>
  repo: Ref<RepoInfo | null>
  permissions: Ref<string[]>
  reload: () => Promise<void>
}

export const sessionKey: InjectionKey<SessionContext> = Symbol('session')
export const repoKey: InjectionKey<RepoContext> = Symbol('repo')

export interface OrgContext {
  name: ComputedRef<string>
  /** Null while loading, and when the name is not an organization. */
  org: Ref<OrgInfo | null>
  reload: () => Promise<void>
}

export const orgKey: InjectionKey<OrgContext> = Symbol('org')
