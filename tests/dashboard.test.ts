import {
  PynAttention,
  PynDashboardCard,
  PynDashboardFirstRun,
  PynDashboardOrganizations,
  PynDashboardRepositories,
  PynRecentItems,
  PynViewAction,
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
import { invitations, orgs } from './fixtures/org-data'
import { sampleRepos } from './fixtures/shell-data'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const LOCK = {
  owner: 'alice',
  name: 'castle-quest',
  path: 'art/hero.psd',
  expires_at: '2099-01-01T00:00:00Z',
}
const NOTICE = { id: 'n1', kind: 'two_factor_reset', detail: 'Second factors were reset.' }

type Answers = Record<string, () => Response>
const calls: string[] = []
function stub(over: Answers = {}) {
  const answers: Answers = {
    'GET /v1/repos': () => json(sampleRepos),
    'GET /v1/me/orgs': () => json(orgs),
    'GET /v1/me/locks': () => json([LOCK]),
    'GET /v1/me/invitations': () => json(invitations),
    'GET /v1/me/notices': () => json([NOTICE]),
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

describe('dashboard cards', () => {
  it('fills each card from its own request', async () => {
    stub()
    const w = await mountDashboard()
    expect(w.findComponent(PynDashboardRepositories).props('repos')).toHaveLength(3)
    expect(w.findComponent(PynDashboardOrganizations).props('orgs')).toHaveLength(2)
    const attention = w.findComponent(PynAttention)
    expect(attention.props('locks')).toEqual([LOCK])
    expect(attention.props('invitations')).toHaveLength(invitations.length)
    expect(attention.props('notices')).toEqual([
      { id: 'n1', text: 'Second factors were reset.', href: '/_/settings/security' },
    ])
    expect(w.findComponent(PynRecentItems).exists()).toBe(true)
  })

  it('links to Explore beside the new-repository action', async () => {
    stub()
    const w = await mountDashboard()
    const hrefs = w.findAllComponents(PynViewAction).map((a) => a.props('href'))
    expect(hrefs).toContain('/_/explore')
    expect(hrefs).toContain('/_/new')
  })

  it('shows the first-run state for an account with no repositories and no organizations', async () => {
    stub({ 'GET /v1/repos': () => json([]), 'GET /v1/me/orgs': () => json([]) })
    const w = await mountDashboard()
    expect(w.findComponent(PynDashboardFirstRun).exists()).toBe(true)
    expect(w.findComponent(PynAttention).exists()).toBe(false)
  })

  it('keeps the dashboard when only one of the two lists is empty', async () => {
    stub({ 'GET /v1/me/orgs': () => json([]) })
    const w = await mountDashboard()
    expect(w.findComponent(PynDashboardFirstRun).exists()).toBe(false)
  })

  it('refreshes the cards after accepting an invitation', async () => {
    let accepted = false
    stub({
      'POST /v1/me/invitations/studio/accept': () => {
        accepted = true
        return json(orgs[0])
      },
      'GET /v1/me/invitations': () => json(accepted ? [] : invitations),
    })
    const w = await mountDashboard()
    const before = calls.filter((c) => c === 'GET /v1/me/invitations').length
    const attention = w.findComponent(PynAttention)
    const event = new MouseEvent('click', { cancelable: true })
    attention.vm.$emit('accept', invitations[0].org, event)
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(calls).toContain(`POST /v1/me/invitations/${invitations[0].org}/accept`)
    expect(calls.filter((c) => c === 'GET /v1/me/invitations').length).toBeGreaterThan(before)
    expect(calls.filter((c) => c === 'GET /v1/me/orgs').length).toBeGreaterThan(1)
  })

  it('fails one card without blanking the page, and retries it', async () => {
    let down = true
    stub({
      'GET /v1/me/orgs': () => (down ? json({ code: 'oops', message: 'down' }, 500) : json(orgs)),
    })
    const w = await mountDashboard()
    const card = w.findComponent(PynDashboardOrganizations)
    expect(card.props('error')).toBeTruthy()
    expect(w.findComponent(PynDashboardRepositories).props('repos')).toHaveLength(3)
    expect(w.findComponent(PynDashboardRepositories).props('error')).toBeFalsy()
    down = false
    card.vm.$emit('retry')
    await flushPromises()
    expect(w.findComponent(PynDashboardOrganizations).props('error')).toBeFalsy()
    expect(w.findComponent(PynDashboardOrganizations).props('orgs')).toHaveLength(2)
  })

  it('shows an attention failure on that card only', async () => {
    stub({ 'GET /v1/me/locks': () => json({ code: 'oops', message: 'down' }, 500) })
    const w = await mountDashboard()
    const cards = w.findAllComponents(PynDashboardCard)
    const attention = cards.find((c) => c.props('heading') === 'Needs your attention')
    expect(attention?.props('error')).toBeTruthy()
    expect(w.findComponent(PynDashboardRepositories).props('repos')).toHaveLength(3)
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
