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
  watcher_count: 2,
  watching: null,
}

function stub(watch: (method: string, body?: string) => Promise<Response>, info = repo) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/v1/repos/acme/game/watch')
      return watch(init?.method ?? 'GET', init?.body as string | undefined)
    if (url === '/v1/repos/acme/game') return json(info)
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

type Wrapper = Awaited<ReturnType<typeof show>>['w']
const shell = (w: Wrapper) => w.findComponent(PynRepoShell)
const watchProps = (w: Wrapper) => shell(w).props('social')?.watch
const watchButton = (w: Wrapper) => w.findAll('button').find((b) => /watch/i.test(b.text()))!
const calls = (m: ReturnType<typeof stub>) =>
  m.mock.calls.filter(([u]) => u === '/v1/repos/acme/game/watch')

afterEach(() => vi.unstubAllGlobals())

describe('repository watch', () => {
  it('shows the watcher count and the three levels', async () => {
    stub(() => json({}))
    const { w } = await show('bob')
    expect(watchProps(w)).toMatchObject({ count: 2, active: false })
    expect(watchProps(w)?.menu?.map((m) => m.label)).toEqual([
      'All activity',
      'Locks only',
      'Ignore',
    ])
  })

  it('watches all activity optimistically and keeps the server count', async () => {
    let release: (r: Response) => void = () => undefined
    const fetchMock = stub(() => new Promise<Response>((resolve) => (release = resolve)))
    const { w } = await show('bob')
    await watchButton(w).trigger('click')
    expect(watchProps(w)).toMatchObject({ count: 3, active: true })
    await flushPromises()
    release(new Response(JSON.stringify({ level: 'all', watchers: 7 })))
    await flushPromises()
    expect(watchProps(w)).toMatchObject({ count: 7, active: true })
    const [, init] = calls(fetchMock)[0]
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(String(init?.body))).toEqual({ level: 'all' })
  })

  it('picks a level from the menu and marks it', async () => {
    const fetchMock = stub(() => json({ level: 'locks', watchers: 3 }))
    const { w } = await show('bob')
    shell(w).vm.$emit('socialMenu', 'watch', 'locks')
    await flushPromises()
    const props = watchProps(w)
    expect(props).toMatchObject({ count: 3, active: true })
    expect(props?.menu?.find((m) => m.checked)?.id).toBe('locks')
    expect(props?.menu?.some((m) => m.id === 'unwatch')).toBe(true)
    expect(JSON.parse(String(calls(fetchMock)[0][1]?.body))).toEqual({ level: 'locks' })
  })

  it('ignoring is not counted and is not shown as watching', async () => {
    stub(() => json({ level: 'ignore', watchers: 1 }), { ...repo, watching: 'all' as never })
    const { w } = await show('bob')
    expect(watchProps(w)).toMatchObject({ count: 2, active: true })
    shell(w).vm.$emit('socialMenu', 'watch', 'ignore')
    await w.vm.$nextTick()
    expect(watchProps(w)).toMatchObject({ count: 1, active: false })
  })

  it('unwatches with the button when watching', async () => {
    const fetchMock = stub(() => json({ level: null, watchers: 1 }), {
      ...repo,
      watching: 'locks' as never,
    })
    const { w } = await show('bob')
    await watchButton(w).trigger('click')
    await flushPromises()
    expect(watchProps(w)).toMatchObject({ count: 1, active: false })
    expect(calls(fetchMock)[0][1]?.method).toBe('DELETE')
  })

  it('rolls back and shows the error when the request fails', async () => {
    stub(() => json({ code: 'too_many_attempts', message: 'slow down' }, 429))
    const { w } = await show('bob')
    await watchButton(w).trigger('click')
    await flushPromises()
    expect(watchProps(w)).toMatchObject({ count: 2, active: false })
    expect(w.text()).toContain('Too many attempts')
  })

  it('asks a signed-out visitor to sign in instead of calling the server', async () => {
    const fetchMock = stub(() => json({ level: 'all', watchers: 3 }))
    const { w, requestSignIn } = await show('')
    await watchButton(w).trigger('click')
    shell(w).vm.$emit('socialMenu', 'watch', 'locks')
    expect(requestSignIn).toHaveBeenCalledTimes(2)
    expect(calls(fetchMock)).toHaveLength(0)
  })
})
