import { PYN_ICON_PACK, fontSets } from '@avalon-initiative/pyn-common-ui'
import type { IconPack } from '@avalon-initiative/pyn-common-ui'
import type { App } from 'vue'
import { fetchHostConfig } from '../api/host-config'
import type { HostConfig } from '../types/host-config.types'

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Validates the raw file: an unknown font set or a malformed pack is dropped with a warning, never fatal. */
export function parseHostConfig(raw: unknown): HostConfig {
  const config: HostConfig = { fontSet: 'default', iconPack: null }
  if (!isObject(raw)) return config
  const set = fontSets.find((s) => s.id === raw.font_set)
  if (set) config.fontSet = set.id
  else if (raw.font_set !== undefined)
    console.warn(`pyn-web: unknown font set "${String(raw.font_set)}", using the default`)
  if (isObject(raw.icon_pack)) config.iconPack = raw.icon_pack as IconPack
  else if (raw.icon_pack !== undefined && raw.icon_pack !== null)
    console.warn('pyn-web: icon_pack must be an object of icon names, ignoring it')
  return config
}

/** Sets the font set on the root element and provides the icon pack when one is configured. */
export function applyHostConfig(app: App, config: HostConfig, root: HTMLElement) {
  root.setAttribute('data-pyn-font-set', config.fontSet)
  if (config.iconPack) app.provide(PYN_ICON_PACK, config.iconPack)
}

export async function configureHost(app: App) {
  applyHostConfig(app, parseHostConfig(await fetchHostConfig()), document.documentElement)
}
