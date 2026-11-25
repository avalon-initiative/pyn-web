import { PynWatchedRepos } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { breadcrumbs } from '../src/state/breadcrumbs.state'
import { sessionKey } from '../src/state/context.state'
import { watchedItems, withLevel } from '../src/state/watching.state'
import type { WatchedRepo } from '../src/types/repo.types'
import WatchingView from '../src/views/WatchingView.vue'
import { sampleRepos } from './fixtures/shell-data'

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const game = { ...sampleRepos[0]!, owner: 'acme', name: 'game', icon_url: null }
const notes = {
  ...sampleRepos[1]!,
  owner: 'alice',
  name: 'notes',
  icon_url: '/v1/repos/alice/notes/icon?v=1',
  owner_identity: { user: 'alice', avatar_url: '/v1/users/alice/avatar?v=1' },
}
const watched: WatchedRepo[] = [
  { repo: game, level: 'all', updated_at: '2026-11-20T10:00:00Z' },
  { repo: notes, level: 'locks', updated_at: '2026-11-19T10:00:00Z' },
]

function stub(watch: (url: string, method: string) => Promise<Response>, list = watched) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/v1/me/watching') return json(list)
    if (url.endsWith('/watch')) return watch(url, init?.method ?? 'GET')
    return json({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function show() {
  const expire = vi.fn()
  const w = mount(WatchingView, {
    global: {
      provide: {
        [sessionKey as symbol]: { user: ref('bob'), admin: ref(false), expire },
      },
    },
  })
  await flushPromises()
  return { w, expire, list: () => w.findComponent(PynWatchedRepos) }
}

const levels = (rows: { repo: { name: string }; level: string }[]) =>
  rows.map((r) => `${r.repo.name}:${r.level}`)

afterEach(() => vi.unstubAllGlobals())

describe('Watching route', () => {
  it('lives under /_/ for signed-in people only, with a trail', () => {
    const to = makeRouter(createMemoryHistory()).resolve('/_/watching')
    expect(to.name).toBe('watching')
    expect(to.meta.public).toBeUndefined()
    expect(breadcrumbs(to).map((c) => c.label)).toEqual(['Home', 'Watching'])
  })
})

describe('watched rows', () => {
  it('carry the level, the pictures and the busy row', () => {
    const rows = watchedItems(watched, 'alice/notes')
    expect(rows.map((r) => [r.level, r.busy])).toEqual([
      ['all', false],
      ['locks', true],
    ])
    expect(rows[0]!.repo).toMatchObject({ icon_url: null, owner_avatar_url: null })
    expect(rows[1]!.repo).toMatchObject({
      icon_url: '/v1/repos/alice/notes/icon?v=1',
      owner_avatar_url: '/v1/users/alice/avatar?v=1',
    })
  })

  it('change one level in place and drop a repository without one', () => {
    const at = { owner: 'acme', name: 'game' }
    expect(levels(withLevel(watched, at, 'ignore'))).toEqual(['game:ignore', 'notes:locks'])
    expect(levels(withLevel(watched, at, null))).toEqual(['notes:locks'])
  })
})

describe('Watching page', () => {
  it('lists the watched repositories with their levels', async () => {
    stub(() => json({}))
    const { list } = await show()
    expect(list().props('loading')).toBe(false)
    expect(levels(list().props('repos'))).toEqual(['game:all', 'notes:locks'])
  })

  it('sets a level and updates the row in place', async () => {
    const fetchMock = stub(() => json({ level: 'ignore', watchers: 4 }))
    const { list } = await show()
    list().vm.$emit('level', { owner: 'acme', name: 'game' }, 'ignore')
    await flushPromises()
    expect(levels(list().props('repos'))).toEqual(['game:ignore', 'notes:locks'])
    const [url, init] = fetchMock.mock.calls.find(([u]) => u.endsWith('/watch'))!
    expect(url).toBe('/v1/repos/acme/game/watch')
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(String(init?.body))).toEqual({ level: 'ignore' })
  })

  it('stops watching and drops the row', async () => {
    const fetchMock = stub(() => json({ level: null, watchers: 0 }))
    const { list } = await show()
    list().vm.$emit('unwatch', { owner: 'alice', name: 'notes' })
    await flushPromises()
    expect(levels(list().props('repos'))).toEqual(['game:all'])
    const [url, init] = fetchMock.mock.calls.find(([u]) => u.endsWith('/watch'))!
    expect(url).toBe('/v1/repos/alice/notes/watch')
    expect(init?.method).toBe('DELETE')
  })

  it('marks the row busy while its request runs', async () => {
    let release: (r: Response) => void = () => undefined
    stub(() => new Promise<Response>((resolve) => (release = resolve)))
    const { list } = await show()
    list().vm.$emit('level', { owner: 'acme', name: 'game' }, 'locks')
    await flushPromises()
    expect(
      list()
        .props('repos')
        .map((r: { busy?: boolean }) => r.busy),
    ).toEqual([true, false])
    release(new Response(JSON.stringify({ level: 'locks', watchers: 1 })))
    await flushPromises()
    expect(
      list()
        .props('repos')
        .map((r: { busy?: boolean }) => r.busy),
    ).toEqual([false, false])
  })

  it('keeps the rows and shows the error when a change fails', async () => {
    stub(() => json({ code: 'too_many_attempts', message: 'slow down' }, 429))
    const { list } = await show()
    list().vm.$emit('unwatch', { owner: 'acme', name: 'game' })
    await flushPromises()
    expect(levels(list().props('repos'))).toEqual(['game:all', 'notes:locks'])
    expect(list().props('error')).toMatch(/^Too many attempts/)
  })

  it('shows the error when the list fails to load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json({ code: 'internal', message: 'boom' }, 500)),
    )
    const { list } = await show()
    expect(list().props('repos')).toEqual([])
    expect(list().props('error')).toBeTruthy()
  })

  it('ends the session on a 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json({ code: 'unauthenticated', message: 'no' }, 401)),
    )
    const { expire } = await show()
    expect(expire).toHaveBeenCalled()
  })
})
