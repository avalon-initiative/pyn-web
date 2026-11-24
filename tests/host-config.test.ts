import { PYN_ICON_PACK } from '@avalon-initiative/pyn-common-ui'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { fetchHostConfig } from '../src/api/host-config'
import { applyHostConfig, parseHostConfig } from '../src/state/host-config.state'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const stubFetch = (res: Response | Error) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() => (res instanceof Error ? Promise.reject(res) : Promise.resolve(res))),
  )

describe('host configuration', () => {
  it('takes the default font set and no icon pack without a file', () => {
    expect(parseHostConfig(undefined)).toEqual({ fontSet: 'default', iconPack: null })
    expect(parseHostConfig([])).toEqual({ fontSet: 'default', iconPack: null })
  })

  it('accepts each shipped font set and an icon pack object', () => {
    for (const id of ['default', 'arcade', 'system'])
      expect(parseHostConfig({ font_set: id }).fontSet).toBe(id)
    const pack = { repo: '<rect width="4" height="4" />' }
    expect(parseHostConfig({ font_set: 'arcade', icon_pack: pack })).toEqual({
      fontSet: 'arcade',
      iconPack: pack,
    })
  })

  it('drops an unknown font set and a malformed pack with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(parseHostConfig({ font_set: 'comic', icon_pack: 'x' })).toEqual({
      fontSet: 'default',
      iconPack: null,
    })
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('a null pack is no pack and stays quiet', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(parseHostConfig({ font_set: 'system', icon_pack: null }).iconPack).toBeNull()
    expect(warn).not.toHaveBeenCalled()
  })

  it('sets the font set on the root and provides the pack only when configured', () => {
    const root = document.createElement('html')
    const app = createApp({})
    applyHostConfig(app, { fontSet: 'arcade', iconPack: null }, root)
    expect(root.getAttribute('data-pyn-font-set')).toBe('arcade')
    expect(app._context.provides[PYN_ICON_PACK as symbol]).toBeUndefined()
    const pack = { repo: '<circle r="2" />' }
    applyHostConfig(app, { fontSet: 'system', iconPack: pack }, root)
    expect(root.getAttribute('data-pyn-font-set')).toBe('system')
    expect(app._context.provides[PYN_ICON_PACK as symbol]).toBe(pack)
  })

  it('reads /config.json and falls back when it is missing, not JSON or unreachable', async () => {
    stubFetch(new Response('{"font_set":"system"}', { status: 200 }))
    expect(await fetchHostConfig()).toEqual({ font_set: 'system' })
    stubFetch(new Response('<!doctype html>', { status: 200 }))
    expect(await fetchHostConfig()).toBeUndefined()
    stubFetch(new Response('', { status: 404 }))
    expect(await fetchHostConfig()).toBeUndefined()
    stubFetch(new Error('offline'))
    expect(await fetchHostConfig()).toBeUndefined()
  })
})
