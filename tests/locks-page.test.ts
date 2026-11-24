import { PynLocksPage } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { repoKey, sessionKey } from '../src/state/context.state'
import MyLocksView from '../src/views/MyLocksView.vue'
import RepoLocksView from '../src/views/RepoLocksView.vue'

const lock = (path: string, owner: string) => ({
  path,
  owner,
  acquired_at: '2026-10-08T10:00:00Z',
  expires_at: '2099-10-08T18:00:00Z',
})
const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body)))

afterEach(() => vi.unstubAllGlobals())

describe('repository locks page', () => {
  async function open(url = '/acme/game/locks') {
    const calls: { url: string; method?: string; body?: string }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string, init?: RequestInit) => {
        calls.push({ url: u, method: init?.method, body: init?.body as string | undefined })
        return json(init?.method === 'POST' ? {} : [lock('a.umap', 'alice'), lock('b.umap', 'bob')])
      }),
    )
    const router = makeRouter(createMemoryHistory())
    await router.push(url)
    const w = mount(RepoLocksView, {
      global: {
        plugins: [router],
        provide: {
          [sessionKey as symbol]: { user: ref('alice'), admin: ref(false), expire: vi.fn() },
          [repoKey as symbol]: {
            target: computed(() => ({ owner: 'acme', name: 'game' })),
            permissions: ref(['read', 'lock', 'force_unlock']),
            frozen: ref(false),
            locks: ref(null),
          },
        },
      },
    })
    await flushPromises()
    return { w, calls, page: w.findComponent(PynLocksPage) }
  }

  it('passes the locks, the viewer, the view and the view links', async () => {
    const { page } = await open('/acme/game/locks?view=mine')
    expect(page.props('locks')).toHaveLength(2)
    expect(page.props('me')).toBe('alice')
    expect(page.props('view')).toBe('mine')
    expect(page.props('canForce')).toBe(true)
    expect(page.props('hrefs')).toEqual({
      all: '/acme/game/locks',
      mine: '/acme/game/locks?view=mine',
      expiring: '/acme/game/locks?view=expiring',
      stale: '/acme/game/locks?view=stale',
    })
  })

  it('falls back to all for an unknown view', async () => {
    expect((await open('/acme/game/locks?view=x')).page.props('view')).toBe('all')
  })

  it('releases a lock and force-releases another with a reason', async () => {
    const { page, calls } = await open()
    page.vm.$emit('release', lock('a.umap', 'alice'))
    await flushPromises()
    const release = calls.find((c) => c.url.endsWith('/release'))!
    expect(JSON.parse(release.body!)).toEqual({ path: 'a.umap' })
    page.vm.$emit('forceRelease', { lock: lock('b.umap', 'bob'), reason: 'left the studio' })
    await flushPromises()
    const force = calls.find((c) => c.url.endsWith('/force-unlock'))!
    expect(JSON.parse(force.body!)).toEqual({ path: 'b.umap', reason: 'left the studio' })
  })

  it('turns on bulk selection and releases each chosen lock once, reporting failures per row', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string, init?: RequestInit) => {
        if (init?.method !== 'POST') return json([lock('a.umap', 'alice'), lock('c.umap', 'alice')])
        const path = JSON.parse(init.body as string).path
        calls.push(path)
        return path === 'c.umap'
          ? Promise.resolve(
              new Response(JSON.stringify({ code: 'not_found', message: 'gone' }), { status: 404 }),
            )
          : json({})
      }),
    )
    const router = makeRouter(createMemoryHistory())
    await router.push('/acme/game/locks')
    const w = mount(RepoLocksView, {
      global: {
        plugins: [router],
        provide: {
          [sessionKey as symbol]: { user: ref('alice'), admin: ref(false), expire: vi.fn() },
          [repoKey as symbol]: {
            target: computed(() => ({ owner: 'acme', name: 'game' })),
            permissions: ref(['read', 'lock']),
            frozen: ref(false),
            locks: ref(null),
          },
        },
      },
    })
    await flushPromises()
    const page = w.findComponent(PynLocksPage)
    expect(page.props('bulk')).toBe(true)
    page.vm.$emit('releaseMany', page.props('locks'))
    await flushPromises()
    expect(calls.sort()).toEqual(['a.umap', 'c.umap'])
    expect(
      page.props('locks').find((l: { path: string }) => l.path === 'c.umap')?.error,
    ).toBeTruthy()
    expect(
      page.props('locks').find((l: { path: string }) => l.path === 'a.umap')?.error,
    ).toBeUndefined()
  })
})

describe('personal locks page', () => {
  it('lists the held locks as rows with their repository and releases one', async () => {
    const calls: { url: string; body?: string }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string, init?: RequestInit) => {
        calls.push({ url: u, body: init?.body as string | undefined })
        if (init?.method === 'POST') return json({})
        return json([{ ...lock('hero.png', 'acme'), name: 'game' }])
      }),
    )
    const router = makeRouter(createMemoryHistory())
    await router.push('/_/locks')
    const w = mount(MyLocksView, {
      global: {
        plugins: [router],
        provide: { [sessionKey as symbol]: { user: ref('alice'), admin: ref(false) } },
      },
    })
    await flushPromises()
    const page = w.findComponent(PynLocksPage)
    expect(page.props('title')).toBe('Your locks')
    expect(page.props('me')).toBe('alice')
    expect(page.props('locks')).toEqual([
      expect.objectContaining({
        path: 'hero.png',
        owner: 'alice',
        repo: 'acme/game',
        repoHref: '/acme/game',
      }),
    ])
    page.vm.$emit('release', page.props('locks')[0])
    await flushPromises()
    const post = calls.find((c) => c.url === '/v1/repos/acme/game/release')!
    expect(JSON.parse(post.body!)).toEqual({ path: 'hero.png' })
  })

  it('releases the chosen locks once each from the bulk bar', async () => {
    const posts: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          posts.push(`${u} ${init.body}`)
          return json({})
        }
        return json([
          { ...lock('a.png', 'acme'), name: 'game' },
          { ...lock('b.png', 'acme'), name: 'game' },
        ])
      }),
    )
    const router = makeRouter(createMemoryHistory())
    await router.push('/_/locks')
    const w = mount(MyLocksView, {
      global: {
        plugins: [router],
        provide: { [sessionKey as symbol]: { user: ref('alice'), admin: ref(false) } },
      },
    })
    await flushPromises()
    const page = w.findComponent(PynLocksPage)
    expect(page.props('bulk')).toBe(true)
    page.vm.$emit('releaseMany', page.props('locks'))
    await flushPromises()
    expect(posts.sort()).toEqual([
      '/v1/repos/acme/game/release {"path":"a.png"}',
      '/v1/repos/acme/game/release {"path":"b.png"}',
    ])
  })
})
