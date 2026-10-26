import { computed, ref } from 'vue'
import { ApiError, describeError } from '../api/client'
import type { FileEntry } from '../types/lock.types'

export const POLICY_PATH = '.pyn/pyn.toml'
export const EDIT_POLICY = 'edit_policy'

/** A failed save, by what the person can do about it. */
export type PolicyConflict =
  | { kind: 'lock_required'; message: string }
  | { kind: 'lock_held'; message: string }
  | { kind: 'stale_base'; message: string }
  | { kind: 'invalid_rules'; message: string }
  | { kind: 'forbidden'; message: string }
  | { kind: 'error'; message: string }

const CONFLICTS = new Set(['lock_required', 'lock_held', 'stale_base', 'invalid_rules'])

export function policyConflict(e: unknown): PolicyConflict {
  if (e instanceof ApiError && CONFLICTS.has(e.code))
    return { kind: e.code as 'lock_required', message: e.message }
  if (e instanceof ApiError && e.status === 403) return { kind: 'forbidden', message: e.message }
  return { kind: 'error', message: describeError(e) }
}

export interface PolicyDeps {
  /** The head entry of the policy file, or null when the repository has none. */
  entry: () => Promise<FileEntry | null>
  /** The policy file's text at the given revision. */
  read: (revision: number) => Promise<string>
  upload: (text: string) => Promise<string>
  checkin: (body: {
    path: string
    content: string
    message: string
    base_revision?: number
  }) => Promise<unknown>
}

/** Loads the policy file, tracks edits and saves them against the revision they were based on. */
export function usePolicyEditor(deps: PolicyDeps, permissions: () => string[]) {
  const saved = ref('')
  const text = ref('')
  const revision = ref<number | null>(null)
  const entry = ref<FileEntry | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const loadError = ref('')
  const conflict = ref<PolicyConflict | null>(null)

  const canEdit = computed(() => permissions().includes(EDIT_POLICY))
  const dirty = computed(() => text.value !== saved.value)

  /** `keepEdits` moves the base to the new head but leaves the edited text, to resolve a stale base. */
  async function load(keepEdits = false) {
    loading.value = true
    loadError.value = ''
    try {
      const head = await deps.entry()
      const rev = head?.revision ?? null
      const body = rev === null ? '' : await deps.read(rev)
      entry.value = head
      revision.value = rev
      saved.value = body
      if (!keepEdits) text.value = body
      if (!keepEdits) conflict.value = null
    } catch (e) {
      loadError.value = describeError(e)
    } finally {
      loading.value = false
    }
  }

  async function save(message: string): Promise<boolean> {
    if (!canEdit.value) {
      conflict.value = {
        kind: 'forbidden',
        message: 'Editing the policy needs the edit_policy permission.',
      }
      return false
    }
    saving.value = true
    conflict.value = null
    try {
      const id = await deps.upload(text.value)
      const base = revision.value === null ? {} : { base_revision: revision.value }
      await deps.checkin({ path: POLICY_PATH, content: id, message, ...base })
      await load()
      return true
    } catch (e) {
      conflict.value = policyConflict(e)
      return false
    } finally {
      saving.value = false
    }
  }

  function discard() {
    text.value = saved.value
    conflict.value = null
  }

  return {
    text,
    revision,
    entry,
    loading,
    saving,
    loadError,
    conflict,
    canEdit,
    dirty,
    load,
    save,
    discard,
  }
}
