import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { RepoInfo } from '../types/repo.types'

export interface SessionContext {
  user: Ref<string>
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
