import { nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'

/** The element id a URL hash names, or null for an empty or malformed hash. */
export function hashId(hash: string): string | null {
  if (hash.length < 2 || !hash.startsWith('#')) return null
  try {
    return decodeURIComponent(hash.slice(1))
  } catch {
    return null
  }
}

/** Scrolls the hash's element into view unless it already is; true when the element exists. */
export function scrollToHash(hash: string): boolean {
  const id = hashId(hash)
  const el = id ? document.getElementById(id) : null
  if (!el) return false
  const r = el.getBoundingClientRect()
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0
  if (r.top < margin || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center' })
  return true
}

/** Scrolls to the route hash once the async content is ready, and again whenever it changes. */
export function useHashScroll(ready: () => unknown) {
  const route = useRoute()
  watch(
    () => [ready(), route.hash],
    async ([ok, hash]) => {
      if (!ok) return
      await nextTick()
      scrollToHash(hash as string)
    },
    { immediate: true, flush: 'post' },
  )
}
