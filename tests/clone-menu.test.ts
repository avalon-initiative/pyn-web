import { PynCloneMenu } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { repoKey, sessionKey } from '../src/state/context.state'
import RepoSettingsLayout from '../src/views/RepoSettingsLayout.vue'

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const repo = {
  id: 'r1',
  owner: 'acme',
  name: 'game',
  visibility: 'private',
  lease_hours: 8,
  max_locks_per_user: 10,
  max_locks_set_by_policy: false,
  created_at: '2026-10-01T09:00:00Z',
  role: 'admin',
}

function stubServer(permissions: string[], org: unknown = null) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/v1/session')
        return json({ user: 'bob', csrf_token: 't', expires_at: '2030-01-01T00:00:00Z' })
      if (url === '/v1/setup') return json({ initialised: true })
      if (url === '/v1/me') return json({ user: 'bob', admin: false })
      if (url === '/v1/server') return json({ version: '0', revision: 'x' })
      if (url === '/v1/repos/acme/game') return json(repo)
      if (url === '/v1/repos/acme/game/me') return json({ permissions })
      if (url === '/v1/orgs/acme') return org ? json(org) : json({ code: 'org_not_found' }, 404)
      if (url.startsWith('/v1/owners/')) return json({ frozen: false })
      return json({ code: 'not_found', message: 'x' }, 404)
    }),
  )
}

async function open(path: string, permissions = ['read', 'lock'], org: unknown = null) {
  stubServer(permissions, org)
  const router = makeRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const { default: App } = await import('../src/App.vue')
  const w = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  await flushPromises()
  return { w, router }
}

afterEach(() => vi.unstubAllGlobals())

describe('clone menu', () => {
  it('offers the address and the command for a reader', async () => {
    const { w } = await open('/acme/game')
    const clone = w.findComponent(PynCloneMenu)
    expect(clone.exists()).toBe(true)
    expect(clone.props('httpsUrl')).toBe(`${window.location.origin}/acme/game`)
    expect(clone.props('command')).toBe('pyn clone acme/game')
  })

  it('is absent without read access', async () => {
    const { w } = await open('/acme/game', [])
    expect(w.findComponent(PynCloneMenu).exists()).toBe(false)
  })
})
