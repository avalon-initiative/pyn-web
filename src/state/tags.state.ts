import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { TagItem, TagOption } from '@avalon-initiative/pyn-common-ui'
import { describeError } from '../api/client'
import type { Tag } from '../types/repo.types'

/** The server's `Tag` in the library's camelCase. */
export function tagItem(t: Tag): TagItem {
  return {
    name: t.name,
    commit: t.commit,
    message: t.message,
    createdAt: t.created_at,
    createdBy: t.created_by,
    committedAt: t.committed_at,
  }
}

/** Newest first, as the picker and the tags page list them; the server orders by name. */
export function newestFirst(tags: Tag[]): Tag[] {
  return [...tags].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/** The repository's tags for the picker, the toolbar count and the tags page. */
export function useTags(
  target: Ref<{ owner: string; name: string }>,
  read: (t: { owner: string; name: string }) => Promise<Tag[]>,
) {
  const tags = ref<Tag[]>([])
  const loading = ref(true)
  const error = ref('')
  const options = computed<TagOption[]>(() =>
    tags.value.map((t) => ({ name: t.name, createdAt: t.created_at })),
  )

  async function load() {
    const t = target.value
    try {
      const list = await read(t)
      if (t !== target.value) return
      tags.value = newestFirst(list)
      error.value = ''
    } catch (e) {
      if (t === target.value) error.value = describeError(e)
    } finally {
      if (t === target.value) loading.value = false
    }
  }

  watch(
    target,
    () => {
      tags.value = []
      loading.value = true
      void load()
    },
    { immediate: true },
  )

  return { tags, options, loading, error, reload: load }
}
