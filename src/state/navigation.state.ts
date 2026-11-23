import { START_LOCATION } from 'vue-router'
import type { Router } from 'vue-router'

const previous = new WeakMap<Router, string>()

/** Remembers where each in-app navigation came from, for a back link. */
export function trackPrevious(router: Router) {
  router.afterEach((to, from) => {
    if (from !== START_LOCATION && from.fullPath !== to.fullPath)
      previous.set(router, from.fullPath)
  })
}

export const previousPath = (router: Router): string | undefined => previous.get(router)
