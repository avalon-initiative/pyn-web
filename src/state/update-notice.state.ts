import { computed, onMounted, ref } from 'vue'
import type { UpdateStatus } from '../types/admin.types'

// Held at module level so a dismissal lasts for the session, across admin pages.
const dismissed = ref(false)

/** The notice to show, or null: any failure, an older server or no newer release shows nothing. */
export function useUpdateNotice(read: () => Promise<UpdateStatus>) {
  const status = ref<UpdateStatus | null>(null)
  const notice = computed(() => {
    const s = status.value
    if (dismissed.value || !s?.enabled || !s.latest) return null
    return {
      current: s.current,
      latest: s.latest,
      prerelease: s.prerelease ?? false,
      url: s.url ?? undefined,
    }
  })
  onMounted(async () => {
    status.value = await read().catch(() => null)
  })
  return { notice, dismiss: () => (dismissed.value = true) }
}

export const resetUpdateNotice = () => (dismissed.value = false)
