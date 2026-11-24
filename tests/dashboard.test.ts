import {
  PynDashboardActivity,
  PynDashboardFirstRun,
  PynDashboardLocks,
  PynDashboardNotices,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { sessionKey } from '../src/state/context.state'
import {
  RECENT_MAX,
  clearRecent,
  recentFor,
  recentItems,
  recordRecent,
  setRecentUser,
} from '../src/state/recent.state'
import { sessionOrgs } from '../src/state/session-data.state'
import DashboardView from '../src/views/DashboardView.vue'
import { orgs } from './fixtures/org-data'
import { sampleRepos } from './fixtures/shell-data'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const LOCK = {
  owner: 'alice',
  name: 'castle-quest',
  path: 'art/hero.psd',
  expires_at: '2099-01-01T00:00:00Z',
}

type Answers = Record<string, () => Response>
const calls: string[] = []
function stub(over: Answers = {}) {
  const answers: Answers = {
    'GET /v1/repos': () => json(sampleRepos),
    'GET /v1/me/orgs': () => json(orgs),
    'GET /v1/me/locks': () => json([LOCK]),
    ...over,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`
      calls.push(key)
      return Promise.resolve(answers[key]?.() ?? json([]))
    }),
  )
}

const mountDashboard = async () => {
  const w = mount(DashboardView, {
    global: {
      provide: {
        [sessionKey as symbol]: { user: ref('dave'), admin: ref(false), expire: vi.fn() },
      },
    },
  })
  await flushPromises()
  return w
}

beforeEach(() => {
  localStorage.clear()
  setRecentUser('')
  sessionOrgs.value = []
})
afterEach(() => {
  vi.unstubAllGlobals()
  calls.length = 0
})

describe('dashboard panels', () => {
  it('fills the locks panels from the locks request', async () => {
    stub()
    const w = await mountDashboard()
    const panels = w.findAllComponents(PynDashboardLocks)
    expect(panels.map((p) => p.props('kind') ?? 'held')).toEqual(['held', 'expiring'])
    for (const p of panels) {
      expect(p.props('locks')).toEqual([LOCK])
      expect(p.props('viewAllHref')).toBe('/_/locks')
    }
    expect(calls.filter((c) => c === 'GET /v1/me/locks')).toHaveLength(1)
  })

  it('shows empty activity and notices without asking the server', async () => {
    stub()
    const w = await mountDashboard()
    expect(w.findComponent(PynDashboardActivity).props('entries')).toEqual([])
    expect(w.findComponent(PynDashboardNotices).props('notices')).toEqual([])
    expect(
      calls.filter((c) => !['GET /v1/repos', 'GET /v1/me/orgs', 'GET /v1/me/locks'].includes(c)),
    ).toEqual([])
  })

  it('shows the first-run state for an account with no repositories and no organizations', async () => {
    stub({ 'GET /v1/repos': () => json([]), 'GET /v1/me/orgs': () => json([]) })
    const w = await mountDashboard()
    expect(w.findComponent(PynDashboardFirstRun).exists()).toBe(true)
    expect(w.findComponent(PynDashboardLocks).exists()).toBe(false)
  })

  it('keeps the dashboard when only one of the two lists is empty', async () => {
    stub({ 'GET /v1/me/orgs': () => json([]) })
    const w = await mountDashboard()
    expect(w.findComponent(PynDashboardFirstRun).exists()).toBe(false)
  })

  it('fails the locks panels without blanking the page, and retries them', async () => {
    let down = true
    stub({
      'GET /v1/me/locks': () =>
        down ? json({ code: 'oops', message: 'down' }, 500) : json([LOCK]),
    })
    const w = await mountDashboard()
    const [held, expiring] = w.findAllComponents(PynDashboardLocks)
    expect(held.props('error')).toBeTruthy()
    expect(expiring.props('error')).toBeTruthy()
    expect(w.findComponent(PynDashboardActivity).exists()).toBe(true)
    down = false
    held.vm.$emit('retry')
    await flushPromises()
    expect(w.findComponent(PynDashboardLocks).props('error')).toBeFalsy()
    expect(w.findComponent(PynDashboardLocks).props('locks')).toEqual([LOCK])
  })
})

describe('recently opened', () => {
  const item = (n: number) => ({
    label: `alice/r${n}`,
    href: `/alice/r${n}`,
    kind: 'repository' as const,
  })

  it('records most recent first and dedupes by link', () => {
    setRecentUser('dave')
    recordRecent(item(1))
    recordRecent(item(2))
    recordRecent(item(1))
    expect(recentItems.value.map((i) => i.href)).toEqual(['/alice/r1', '/alice/r2'])
  })

  it('caps the list', () => {
    setRecentUser('dave')
    for (let n = 0; n < RECENT_MAX + 5; n++) recordRecent(item(n))
    expect(recentItems.value).toHaveLength(RECENT_MAX)
    expect(recentItems.value[0].href).toBe(`/alice/r${RECENT_MAX + 4}`)
  })

  it('clears the list and its stored copy', () => {
    setRecentUser('dave')
    recordRecent(item(1))
    clearRecent()
    expect(recentItems.value).toEqual([])
    setRecentUser('')
    setRecentUser('dave')
    expect(recentItems.value).toEqual([])
  })

  it('keeps a list per signed-in user', () => {
    setRecentUser('dave')
    recordRecent(item(1))
    setRecentUser('erin')
    expect(recentItems.value).toEqual([])
    recordRecent(item(2))
    setRecentUser('dave')
    expect(recentItems.value).toEqual([item(1)])
  })

  it('adds pages opened before the user was known', () => {
    recordRecent(item(1))
    setRecentUser('dave')
    expect(recentItems.value).toEqual([item(1)])
  })

  it('ignores a damaged stored list', () => {
    localStorage.setItem('pyn.recent.dave', '{"nope"')
    setRecentUser('dave')
    expect(recentItems.value).toEqual([])
  })

  it('records repository, file and owner pages but not others', () => {
    sessionOrgs.value = [orgs[0]]
    const at = (path: string) => recentFor(makeRouter(createMemoryHistory()).resolve(path))
    expect(at('/alice/game')).toEqual({
      label: 'alice/game',
      href: '/alice/game',
      kind: 'repository',
    })
    expect(at('/alice/game/blob/a/b.txt')).toMatchObject({
      kind: 'file',
      label: 'alice/game: a/b.txt',
    })
    expect(at('/studio')).toMatchObject({ kind: 'organization', href: '/studio' })
    expect(at('/bob')).toMatchObject({ kind: 'person' })
    expect(at('/_/locks')).toBeNull()
    expect(at('/_/nothing/here')).toBeNull()
  })

  it('records on a successful navigation only', async () => {
    setRecentUser('dave')
    const router = makeRouter(createMemoryHistory())
    await router.push('/alice/game')
    await router.push('/_/locks')
    expect(recentItems.value.map((i) => i.href)).toEqual(['/alice/game'])
  })
})

describe('routes', () => {
  it('shows the dashboard at / and keeps the repository list at /_/repos', () => {
    const router = makeRouter(createMemoryHistory())
    expect(router.resolve('/').matched[0].components?.default).toBe(DashboardView)
    expect(router.resolve('/_/repos').name).toBe('repos')
  })
})
