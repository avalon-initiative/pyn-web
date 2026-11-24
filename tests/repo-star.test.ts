import { PynRepoShell } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { sessionKey } from '../src/state/context.state'
import RepoView from '../src/views/RepoView.vue'

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const repo = {
  id: 'r1',
  owner: 'acme',
  name: 'game',
  visibility: 'public',
  lease_hours: 8,
  created_at: '2026-10-01T09:00:00Z',
  star_count: 3,
  starred: false,
}

function stub(star: (method: string) => Promise<Response>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/v1/repos/acme/game/star') return star(init?.method ?? 'GET')
    if (url === '/v1/repos/acme/game') return json(repo)
    if (url === '/v1/repos/acme/game/me') return json({ permissions: ['read'] })
    if (url.startsWith('/v1/owners/')) return json({ frozen: false })
    if (url.startsWith('/v1/orgs/')) return json({ code: 'org_not_found' }, 404)
    if (url.endsWith('/branches')) return json([{ name: 'main', default: true }])
    if (url.endsWith('/locks')) return json([])
    return json({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function show(user: string, requestSignIn = vi.fn()) {
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
          requestSignIn,
        },
      },
    },
  })
  await flushPromises()
  return { w, requestSignIn }
}

const starButton = (w: Awaited<ReturnType<typeof show>>['w']) =>
  w.findAll('button').find((b) => /star/i.test(b.text()))!

afterEach(() => vi.unstubAllGlobals())

describe('repository star', () => {
  it('shows the count and only the star control', async () => {
    stub(() => json({ starred: true, count: 4 }))
    const { w } = await show('bob')
    expect(w.findComponent(PynRepoShell).props('social')).toEqual({
      star: { count: 3, active: false, disabled: false },
    })
  })

  it('stars optimistically and keeps the server count', async () => {
    let release: (r: Response) => void = () => undefined
    const fetchMock = stub(() => new Promise<Response>((resolve) => (release = resolve)))
    const { w } = await show('bob')
    await starButton(w).trigger('click')
    expect(w.findComponent(PynRepoShell).props('social')?.star).toMatchObject({
      count: 4,
      active: true,
    })
    release(new Response(JSON.stringify({ starred: true, count: 5 })))
    await flushPromises()
    expect(w.findComponent(PynRepoShell).props('social')?.star).toMatchObject({
      count: 5,
      active: true,
    })
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true)
  })

  it('rolls back and shows the error when the request fails', async () => {
    stub(() => json({ code: 'too_many_attempts', message: 'slow down' }, 429))
    const { w } = await show('bob')
    await starButton(w).trigger('click')
    await flushPromises()
    expect(w.findComponent(PynRepoShell).props('social')?.star).toMatchObject({
      count: 3,
      active: false,
    })
    expect(w.text()).toContain('Too many attempts')
  })

  it('asks a signed-out visitor to sign in instead of calling the server', async () => {
    const fetchMock = stub(() => json({ starred: true, count: 4 }))
    const { w, requestSignIn } = await show('')
    await starButton(w).trigger('click')
    expect(requestSignIn).toHaveBeenCalled()
    expect(fetchMock.mock.calls.some(([u]) => u === '/v1/repos/acme/game/star')).toBe(false)
  })
})
