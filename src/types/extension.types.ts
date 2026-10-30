import type { MenuItem, NavItem } from '@avalon-initiative/pyn-common-ui'
import type { RouteRecordRaw } from 'vue-router'

/** A top-level account-menu entry: a link (`href`) or a button that runs `onSelect`. */
export interface AccountMenuItem extends MenuItem {
  onSelect?: () => void
}

/** Build-time additions to the app; every list is optional. */
export interface PynExtension {
  /** Top-level routes; each path must sit under EXTENSION_PREFIX. */
  routes?: RouteRecordRaw[]
  /** Side-nav entries, listed after the built-in ones. */
  navItems?: NavItem[]
  /** Account-menu entries, listed after the built-in ones. */
  accountMenuItems?: AccountMenuItem[]
}
