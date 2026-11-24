import {
  PynBranchPicker,
  PynFileView,
  PynHistory,
  PynRepoLanding,
  PynTagsPage,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { createTag, deleteTag, getTag, listTags } from '../src/api/tags'
import { makeRouter } from '../src/router'
import { repoKey } from '../src/state/context.state'
import { newestFirst, tagItem } from '../src/state/tags.state'
import RepoTagsView from '../src/views/RepoTagsView.vue'
import { repo as repoInfo, rootListing, summary } from './fixtures/landing-data'

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const tag = (name: string) => ({
  name,
  commit: 'c'.repeat(40),
  message: 'First cut',
  created_at: '2026-11-01T09:00:00Z',
  created_by: 'bob',
  committed_at: '2026-10-31T09:00:00Z',
})

const branch = (name: string, isDefault = false) => ({
  name,
  commit: 'a'.repeat(40),
  default: isDefault,
  created_at: '2026-10-01T09:00:00Z',
  created_by: 'bob',
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('tags client', () => {
  it('reads, creates and deletes tags at their addresses', async () => {
    const calls: { url: string; method: string; body?: string }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET'
        calls.push({ url, method, body: init?.body as string | undefined })
        if (method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }))
        return json(url.endsWith('/tags') && method === 'GET' ? [tag('v1')] : tag('v1'))
      }),
    )
    const r = { owner: 'acme', name: 'game' }
    expect(await listTags(r)).toEqual([tag('v1')])
    await createTag(r, { name: 'v1', target: 'main', message: 'First cut' })
    await getTag(r, 'release/v1')
    await deleteTag(r, 'release/v1')
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'GET /v1/repos/acme/game/tags',
      'POST /v1/repos/acme/game/tags',
      'GET /v1/repos/acme/game/tags/release%2Fv1',
      'DELETE /v1/repos/acme/game/tags/release%2Fv1',
    ])
    expect(JSON.parse(calls[1]!.body!)).toEqual({
      name: 'v1',
      target: 'main',
      message: 'First cut',
    })
  })

  it('orders tags newest first', () => {
    const old = { ...tag('a'), created_at: '2026-01-01T00:00:00Z' }
    const recent = { ...tag('b'), created_at: '2026-11-01T00:00:00Z' }
    expect(newestFirst([old, recent]).map((t) => t.name)).toEqual(['b', 'a'])
  })

  it('maps a tag to the camelCase row', () => {
    expect(tagItem(tag('v1'))).toEqual({
      name: 'v1',
      commit: 'c'.repeat(40),
      message: 'First cut',
      createdAt: '2026-11-01T09:00:00Z',
      createdBy: 'bob',
      committedAt: '2026-10-31T09:00:00Z',
    })
  })
})

async function openPage(
  opts: {
    permissions?: string[]
    frozen?: boolean
    url?: string
    postReply?: () => Promise<Response>
    deleteReply?: () => Promise<Response>
  } = {},
) {
  const calls: { url: string; method: string; body?: string }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push({ url, method, body: init?.body as string | undefined })
      if (method === 'POST') return opts.postReply?.() ?? json(tag('v2'))
      if (method === 'DELETE')
        return opts.deleteReply?.() ?? Promise.resolve(new Response(null, { status: 204 }))
      return json([tag('v1')])
    }),
  )
  const reloadTags = vi.fn(() => Promise.resolve())
  const router = makeRouter(createMemoryHistory())
  await router.push(opts.url ?? '/acme/game/tags')
  const w = mount(RepoTagsView, {
    global: {
      plugins: [router],
      provide: {
        [repoKey as symbol]: {
          target: ref({ owner: 'acme', name: 'game' }),
          permissions: ref(opts.permissions ?? ['read', 'checkin']),
          frozen: ref(opts.frozen ?? false),
          branches: ref([{ name: 'main', isDefault: true }]),
          reloadTags,
        },
      },
    },
  })
  await flushPromises()
  return { w, page: w.findComponent(PynTagsPage), calls, reloadTags }
}

describe('tags page', () => {
  it('lists the tags in camelCase with the branches as targets', async () => {
    const { page } = await openPage()
    expect(page.props('tags')).toEqual([tagItem(tag('v1'))])
    expect(page.props('branches')).toEqual([{ name: 'main', isDefault: true }])
    expect(page.props('loading')).toBe(false)
  })

  it('offers create and delete only with checkin on an unfrozen owner', async () => {
    expect((await openPage()).page.props('canCreate')).toBe(true)
    for (const o of [{ permissions: ['read'] }, { frozen: true }]) {
      const { page } = await openPage(o)
      expect(page.props('canCreate')).toBe(false)
      expect(page.props('canDelete')).toBe(false)
    }
  })

  it('starts filtered by the tag named in the address', async () => {
    const { page } = await openPage({ url: '/acme/game/tags?q=v1' })
    expect(page.props('query')).toBe('v1')
  })

  it('creates a tag, closes the dialog and rereads the list', async () => {
    let finish: (r: Response) => void = () => {}
    const { page, calls, reloadTags } = await openPage({
      postReply: () => new Promise((resolve) => (finish = resolve)),
    })
    await page.setValue(true, 'creating')
    page.vm.$emit('create', { name: 'v2', target: 'main', message: '' })
    await flushPromises()
    expect(page.props('busy')).toBe(true)
    finish(new Response(JSON.stringify(tag('v2')), { status: 200 }))
    await flushPromises()
    const post = calls.find((c) => c.method === 'POST')!
    expect(post.url).toBe('/v1/repos/acme/game/tags')
    expect(JSON.parse(post.body!)).toEqual({ name: 'v2', target: 'main' })
    expect(page.props('creating')).toBe(false)
    expect(page.props('busy')).toBe(false)
    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(2)
    expect(reloadTags).toHaveBeenCalled()
  })

  it('keeps the dialog open with the error when create fails', async () => {
    const { page } = await openPage({
      postReply: () => json({ code: 'tag_exists', message: 'taken' }, 409),
    })
    await page.setValue(true, 'creating')
    page.vm.$emit('create', { name: 'v1', target: 'main' })
    await flushPromises()
    expect(page.props('creating')).toBe(true)
    expect(page.props('dialogError')).toMatch(/already exists/)
  })

  it('deletes a tag and closes its confirmation', async () => {
    const { page, calls } = await openPage()
    await page.setValue('release/v1', 'deleting')
    page.vm.$emit('delete', 'release/v1')
    await flushPromises()
    expect(calls.find((c) => c.method === 'DELETE')!.url).toBe(
      '/v1/repos/acme/game/tags/release%2Fv1',
    )
    expect(page.props('deleting')).toBe('')
  })

  it('keeps the confirmation open with the error when delete fails', async () => {
    const { page } = await openPage({
      deleteReply: () => json({ code: 'tag_not_found', message: 'gone' }, 404),
    })
    await page.setValue('v1', 'deleting')
    page.vm.$emit('delete', 'v1')
    await flushPromises()
    expect(page.props('deleting')).toBe('v1')
    expect(page.props('dialogError')).toMatch(/does not exist/)
  })
})

const repo = { ...repoInfo, owner: 'acme', name: 'game' }

function stubServer() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const [path] = url.split('?')
      if (path === '/v1/session')
        return json({ user: 'bob', csrf_token: 't', expires_at: '2030-01-01T00:00:00Z' })
      if (path === '/v1/setup') return json({ initialised: true })
      if (path === '/v1/me') return json({ user: 'bob', admin: false })
      if (path === '/v1/server') return json({ version: '0', revision: 'x' })
      if (path === '/v1/repos/acme/game') return json(repo)
      if (path === '/v1/repos/acme/game/me') return json({ permissions: ['read', 'checkin'] })
      if (path === '/v1/repos/acme/game/branches')
        return json([branch('main', true), branch('feature')])
      if (path === '/v1/repos/acme/game/tags') return json([tag('v1'), tag('v2')])
      if (path === '/v1/repos/acme/game/tree') return json(rootListing)
      if (path === '/v1/repos/acme/game/summary') return json(summary)
      if (path === '/v1/repos/acme/game/history') return json({ revisions: [], next_cursor: null })
      if (path === '/v1/orgs/acme') return json({ code: 'org_not_found' }, 404)
      if (path.startsWith('/v1/owners/')) return json({ frozen: false })
      return json({ code: 'not_found', message: 'x' }, 404)
    }),
  )
}

async function openApp(path: string) {
  stubServer()
  const router = makeRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const { default: App } = await import('../src/App.vue')
  const w = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  await flushPromises()
  return { w, router }
}

const tagOptions = [
  { name: 'v1', createdAt: '2026-11-01T09:00:00Z' },
  { name: 'v2', createdAt: '2026-11-01T09:00:00Z' },
]

describe('tags in the pickers', () => {
  it('gives the landing toolbar the tag count, link and picker tags', async () => {
    const landing = (await openApp('/acme/game')).w.findComponent(PynRepoLanding)
    expect(landing.props('tags')).toEqual(tagOptions)
    expect(landing.props('tagCount')).toBe(2)
    expect(landing.props('tagsHref')).toBe('/acme/game/tags')
    expect(landing.props('tagsLoading')).toBe(false)
  })

  it('passes the tags to the file view and history pickers', async () => {
    for (const [path, view] of [
      ['/acme/game/blob/a.txt', PynFileView],
      ['/acme/game/history', PynHistory],
    ] as const) {
      const c = (await openApp(path)).w.findComponent(view)
      expect(c.props('tags')).toEqual(tagOptions)
      expect(c.props('tagsHref')).toBe('/acme/game/tags')
    }
  })

  it('opens the tags page on a chosen tag and switches branches as before', async () => {
    const { w, router } = await openApp('/acme/game/history')
    w.findComponent(PynBranchPicker).vm.$emit('select', 'feature', 'branch')
    await flushPromises()
    expect(router.currentRoute.value.query.branch).toBe('feature')
    w.findComponent(PynBranchPicker).vm.$emit('select', 'v1', 'tag')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/acme/game/tags')
    expect(router.currentRoute.value.query).toEqual({ q: 'v1' })
    expect(w.findComponent(PynTagsPage).props('query')).toBe('v1')
  })
})
