import { ref, watch } from 'vue'
import type { Ref } from 'vue'
import type {
  OwnerUsage,
  RepoUsage,
  RepoUsageBreakdown,
  SetRepoStorageCapRequest,
} from '@avalon-initiative/pyn-common-ui'
import { useAction } from './action.state'

type Repo = { owner: string; name: string }

/** Loads the usage of `owner`, again when it changes; a refusal is kept as text. */
export function useOwnerUsage(owner: Ref<string>, read: (owner: string) => Promise<OwnerUsage>) {
  const usage = ref<OwnerUsage | null>(null)
  const loaded = ref(false)
  const { error, attempt } = useAction()

  watch(
    owner,
    async () => {
      usage.value = null
      loaded.value = false
      await attempt(async () => {
        usage.value = await read(owner.value)
      })
      loaded.value = true
    },
    { immediate: true },
  )

  return { usage, loaded, error }
}

export interface RepoStorageApi {
  usage: (r: Repo) => Promise<RepoUsage>
  breakdown: (r: Repo) => Promise<RepoUsageBreakdown>
  setCap: (r: Repo, body: SetRepoStorageCapRequest) => Promise<SetRepoStorageCapRequest>
}

/** Storage of one repository: the cap, the breakdown for administrators, and saving or clearing the cap. */
export function useRepoStorage(
  target: Ref<Repo>,
  withBreakdown: Ref<boolean>,
  remote: RepoStorageApi,
) {
  const usage = ref<RepoUsage | null>(null)
  const breakdown = ref<RepoUsageBreakdown | null>(null)
  const loaded = ref(false)
  const loading = useAction()
  const saving = useAction()

  const load = () =>
    loading.attempt(async () => {
      const t = target.value
      usage.value = await remote.usage(t)
      breakdown.value = withBreakdown.value ? await remote.breakdown(t) : null
    })

  const write = (storage_bytes: number | null) =>
    saving.attempt(async () => {
      await remote.setCap(target.value, { storage_bytes })
      await load()
    })

  watch(
    target,
    async () => {
      usage.value = null
      breakdown.value = null
      loaded.value = false
      await load()
      loaded.value = true
    },
    { immediate: true },
  )

  return {
    usage,
    breakdown,
    loaded,
    loadError: loading.error,
    busy: saving.busy,
    error: saving.error,
    save: (body: SetRepoStorageCapRequest) => write(body.storage_bytes),
    clear: () => write(null),
  }
}
