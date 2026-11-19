import { ref } from 'vue'
import { listPeople } from '../api/people'
import type { PersonEntry } from '../api/people'
import { describeError } from '../api/client'

export const PEOPLE_SEARCH_MAX = 64

/** Search and paging over the people directory; a failure, a 429 included, is text and leaves the list as it was. */
export function usePeople(pageSize = 30) {
  const people = ref<PersonEntry[]>([])
  const next = ref<string | null>(null)
  const query = ref('')
  const loaded = ref(false)
  const busy = ref(false)
  const error = ref('')

  async function load(append: boolean) {
    busy.value = true
    error.value = ''
    try {
      const page = await listPeople({
        q: query.value.trim() || undefined,
        after: append ? (next.value ?? undefined) : undefined,
        limit: pageSize,
      })
      people.value = append ? [...people.value, ...page.people] : page.people
      next.value = page.next_after ?? null
      loaded.value = true
    } catch (e) {
      error.value = describeError(e)
    } finally {
      busy.value = false
    }
  }

  return {
    people,
    next,
    query,
    loaded,
    busy,
    error,
    search: (q: string) => ((query.value = q.slice(0, PEOPLE_SEARCH_MAX)), load(false)),
    more: () => (next.value ? load(true) : Promise.resolve()),
  }
}
