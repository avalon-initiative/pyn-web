import type { NavItem } from '@avalon-initiative/pyn-common-ui'
import type { AccountMenuItem, PynExtension } from '../types/extension.types'

/** Neither "_" nor "-" can be a user, organization or repository name, so nothing here can shadow `/:owner/:name`. */
export const EXTENSION_PREFIX = '/_/x'

const underPrefix = (path: string) =>
  path === EXTENSION_PREFIX || path.startsWith(`${EXTENSION_PREFIX}/`)

const internal = (href: string) => href.startsWith('/') && !href.startsWith('//')

/** Throws on the first entry that would collide with a built-in route, name or nav id. */
export function validateExtension(
  ext: PynExtension,
  taken: { routeNames: Set<string>; navIds: Set<string> },
): void {
  const names = new Set(taken.routeNames)
  for (const r of ext.routes ?? []) {
    if (!underPrefix(r.path))
      throw new Error(`extra route "${r.path}" must be under ${EXTENSION_PREFIX}/`)
    if (r.alias) throw new Error(`extra route "${r.path}" must not declare an alias`)
    if (typeof r.name === 'string') {
      if (names.has(r.name)) throw new Error(`extra route name "${r.name}" is already used`)
      names.add(r.name)
    }
  }
  const ids = new Set(taken.navIds)
  for (const item of [...(ext.navItems ?? []), ...(ext.accountMenuItems ?? [])]) {
    if (item.href && !internal(item.href))
      throw new Error(`entry "${item.id}" needs an internal href`)
    if (ids.has(item.id)) throw new Error(`entry id "${item.id}" is already used`)
    ids.add(item.id)
  }
}

/** The extra nav entry whose href is the current path or a parent of it. */
export function activeExtraNav(path: string, items: NavItem[]): string {
  const hit = items.find((i) => path === i.href || path.startsWith(`${i.href}/`))
  return hit?.id ?? ''
}

/** Runs the handler of the account-menu button with this id, if it has one. */
export function selectAccountItem(items: AccountMenuItem[], id: string): void {
  items.find((i) => i.id === id)?.onSelect?.()
}
