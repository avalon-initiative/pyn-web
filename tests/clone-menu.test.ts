import { PynCloneMenu, PynRepoLanding } from '@avalon-initiative/pyn-common-ui'
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
      if (url.startsWith('/v1/repos/acme/game/tree'))
        return json({
          path: '',
          entries: [{ name: 'a.txt', path: 'a.txt', kind: 'file', mode: 'shared' }],
        })
      if (url.startsWith('/v1/repos/acme/game/summary'))
        return json({
          default_branch: 'main',
          files: 1,
          exclusive_files: 0,
          shared_files: 1,
          locks: [],
          activity: [],
        })
      if (url === '/v1/repos/acme/game/branches')
        return json([
          { name: 'main', default: true, updated_at: '2026-10-02T00:00:00Z' },
          { name: 'dev', default: false, updated_at: '2026-10-03T00:00:00Z' },
          { name: 'old', default: false, updated_at: '2026-09-01T00:00:00Z' },
          { name: 'b4', default: false, updated_at: '2026-08-01T00:00:00Z' },
          { name: 'b5', default: false, updated_at: '2026-07-01T00:00:00Z' },
          { name: 'b6', default: false, updated_at: '2026-06-01T00:00:00Z' },
        ])
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
  it('offers the address and the command for a reader, in the landing toolbar', async () => {
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

describe('landing toolbar wiring', () => {
  it('passes every branch, the count and the Branches link', async () => {
    const { w } = await open('/acme/game')
    const landing = w.findComponent(PynRepoLanding)
    expect(landing.props('branches')).toHaveLength(6)
    expect(landing.props('branchCount')).toBe(6)
    expect(landing.props('branchesHref')).toBe('/acme/game/branches')
    expect(landing.props('cloneCommand')).toBe('pyn clone acme/game')
  })

  it('switches the branch through the address on select', async () => {
    const { w, router } = await open('/acme/game')
    w.findComponent(PynRepoLanding).vm.$emit('select', 'dev')
    await flushPromises()
    expect(router.currentRoute.value.query.branch).toBe('dev')
    w.findComponent(PynRepoLanding).vm.$emit('select', 'main')
    await flushPromises()
    expect(router.currentRoute.value.query.branch).toBeUndefined()
  })
})
