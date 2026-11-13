import { PynShell, PynVersionFooter } from '@avalon-initiative/pyn-common-ui'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchServerBuild } from '../src/api/server'
import { webRevision, webVersion } from '../src/state/version.state'

const reply = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }))

afterEach(() => vi.unstubAllGlobals())

describe('web build', () => {
  it('bakes in the package version and a revision', () => {
    expect(webVersion).toMatch(/^\d+\.\d+\.\d+/)
    expect(webRevision).not.toBe('')
  })
})

describe('fetchServerBuild', () => {
  it('reads version and revision from capabilities', async () => {
    vi.stubGlobal(
      'fetch',
      reply(200, { local_commits: true, version: '0.1.2', revision: 'abc1234' }),
    )
    expect(await fetchServerBuild()).toEqual({ version: '0.1.2', revision: 'abc1234' })
  })

  it('is null for an older server without a version', async () => {
    vi.stubGlobal('fetch', reply(200, { local_commits: true }))
    expect(await fetchServerBuild()).toBeNull()
  })

  it('is null when the request fails', async () => {
    vi.stubGlobal('fetch', reply(500, { code: 'error', message: 'boom' }))
    expect(await fetchServerBuild()).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await fetchServerBuild()).toBeNull()
  })
})

describe('version footer in the shell', () => {
  const footer = (props: Record<string, string | undefined>) =>
    mount(PynShell, {
      slots: { footer: () => h(PynVersionFooter, { webVersion: '0.1.2', ...props }) },
    }).getComponent(PynVersionFooter)

  it('shows both versions', () => {
    const w = footer({ serverVersion: '0.1.4' })
    expect(w.text()).toContain('web v0.1.2')
    expect(w.text()).toContain('server v0.1.4')
    expect(w.attributes('data-mismatch')).toBe('false')
  })

  it('flags a different minor version', () => {
    const w = footer({ serverVersion: '0.2.0' })
    expect(w.attributes('data-mismatch')).toBe('true')
    expect(w.text()).toContain('version mismatch')
  })

  it('shows server unknown without flagging when the server version is missing', () => {
    const w = footer({})
    expect(w.text()).toContain('server unknown')
    expect(w.attributes('data-mismatch')).toBe('false')
  })
})
