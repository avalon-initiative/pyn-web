import { FORK_CREATE, PynRepoShell } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { sessionKey } from '../src/state/context.state'
import RepoView from '../src/views/RepoView.vue'

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const source = {
  id: 'r1',
  owner: 'acme',
  name: 'game',
  visibility: 'public',
  lease_hours: 8,
  created_at: '2026-10-01T09:00:00Z',
  star_count: 0,
  starred: false,
  watcher_count: 0,
  watching: null,
  fork_count: 0,
  fork_of: null,
  allow_private_forks: false,
}

function stub(info: Record<string, unknown>) {
  const fetchMock = vi.fn((url: string) => {
    if (url === '/v1/repos/acme/game') return json({ ...source, ...info })
    if (url === '/v1/repos/acme/game/forks')
      return json([
        { ...source, owner: 'bob', name: 'game', fork_of: { owner: 'acme', name: 'game' } },
        {
          ...source,
          owner: 'studio',
          name: 'game',
          fork_of: { owner: 'acme', name: 'game' },
          icon_url: '/v1/repos/studio/game/icon?v=1',
          owner_identity: { user: 'studio', avatar_url: '/v1/orgs/studio/avatar?v=2' },
        },
      ])
    if (url === '/v1/repos/acme/game/me') return json({ permissions: ['read'] })
    if (url === '/v1/me/orgs') return json([])
    if (url.startsWith('/v1/owners/')) return json({ frozen: false })
    if (url.startsWith('/v1/orgs/')) return json({ code: 'org_not_found' }, 404)
    if (url.endsWith('/branches')) return json([{ name: 'main', default: true }])
    if (url.endsWith('/locks')) return json([])
    return json({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function show(user: string, info: Record<string, unknown> = {}) {
  const fetchMock = stub(info)
  const router = makeRouter(createMemoryHistory())
  await router.push('/acme/game/locks')
  await router.isReady()
  const w = mount(RepoView, {
    global: {
      plugins: [router],
      provide: {
        [sessionKey as symbol]: {
          user: ref(user),
          admin: ref(false),
          expire: vi.fn(),
          requestSignIn: vi.fn(),
        },
      },
    },
  })
  await flushPromises()
  return { w, router, fetchMock, shell: w.findComponent(PynRepoShell) }
}

const forkCalls = (m: ReturnType<typeof stub>) =>
  m.mock.calls.filter(([u]) => u === '/v1/repos/acme/game/forks')

describe('Fork in the repository header', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows the fork count and lists existing forks', async () => {
    const { shell, fetchMock } = await show('alice', { fork_count: 1 })
    expect(shell.props('social')?.fork).toEqual({ count: 1, disabled: false })
    expect(shell.props('social')?.forks).toEqual([
      { owner: 'bob', name: 'game', href: '/bob/game', iconUrl: null, ownerAvatarUrl: null },
      {
        owner: 'studio',
        name: 'game',
        href: '/studio/game',
        iconUrl: '/v1/repos/studio/game/icon?v=1',
        ownerAvatarUrl: '/v1/orgs/studio/avatar?v=2',
      },
    ])
    expect(forkCalls(fetchMock).length).toBeGreaterThan(0)
  })

  it('shows the repository icon in the header, null without one', async () => {
    const icon = '/v1/repos/acme/game/icon?v=abc'
    expect((await show('alice', { icon_url: icon })).shell.props('iconUrl')).toBe(icon)
    vi.unstubAllGlobals()
    expect((await show('alice', { icon_url: null })).shell.props('iconUrl')).toBeNull()
  })

  it('gives an empty list without asking when there are no forks', async () => {
    const { shell, fetchMock } = await show('alice')
    expect(shell.props('social')?.forks).toEqual([])
    expect(forkCalls(fetchMock)).toHaveLength(0)
  })

  it('disables Fork signed out and on a private source that does not allow forks', async () => {
    expect((await show('')).shell.props('social')?.fork?.disabled).toBe(true)
    vi.unstubAllGlobals()
    const closed = await show('acme', { visibility: 'private', role: 'admin' })
    expect(closed.shell.props('social')?.fork?.disabled).toBe(true)
    vi.unstubAllGlobals()
    const open = await show('bob', { visibility: 'private', allow_private_forks: true })
    expect(open.shell.props('social')?.fork?.disabled).toBe(false)
  })

  it('opens the create-fork page from the menu and the button', async () => {
    const { shell, router } = await show('alice')
    shell.vm.$emit('socialMenu', 'fork', FORK_CREATE)
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/acme/game/fork')
    await router.push('/acme/game/locks')
    shell.vm.$emit('social', 'fork')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/acme/game/fork')
  })

  it('does not open the page when forking is not allowed', async () => {
    const { shell, router } = await show('bob', { visibility: 'private' })
    shell.vm.$emit('social', 'fork')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/acme/game/locks')
  })

  it('links a fork to its source', async () => {
    const { shell } = await show('alice', { fork_of: { owner: 'zed', name: 'castle' } })
    expect(shell.props('forkOf')).toEqual({ owner: 'zed', name: 'castle', href: '/zed/castle' })
    vi.unstubAllGlobals()
    expect((await show('alice')).shell.props('forkOf')).toBeUndefined()
  })
})
