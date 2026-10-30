import { createApp } from 'vue'
import { createWebHistory } from 'vue-router'
import type { RouteRecordRaw, RouterHistory } from 'vue-router'
import { navItems as builtInNav } from '@avalon-initiative/pyn-common-ui'
import App from './App.vue'
import { routes as builtInRoutes, makeRouter } from './router'
import { validateExtension } from './state/extension.state'
import type { PynExtension } from './types/extension.types'

const namesOf = (rs: readonly RouteRecordRaw[]): string[] =>
  rs.flatMap((r) => [...(typeof r.name === 'string' ? [r.name] : []), ...namesOf(r.children ?? [])])

/** Builds the app with the build-time additions; call with nothing for the standard app. Throws on a colliding entry. */
export function createPynApp(ext: PynExtension = {}, history: RouterHistory = createWebHistory()) {
  validateExtension(ext, {
    routeNames: new Set(namesOf(builtInRoutes)),
    navIds: new Set([...builtInNav(true).map((i) => i.id), 'webhooks']),
  })
  return createApp(App, {
    navItems: ext.navItems ?? [],
    accountMenuItems: ext.accountMenuItems ?? [],
  }).use(makeRouter(history, ext.routes ?? []))
}
