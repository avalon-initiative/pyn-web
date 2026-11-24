import { PynShell, PynTopBar } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { clearSessionData } from '../src/state/session-data.state'
import { refreshTopBar, resetTopBar, topBarOwners } from '../src/state/top-bar.state'
import { invitations, orgs } from './fixtures/org-data'
import { sampleRepos } from './fixtures/shell-data'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const soon = () => new Date(Date.now() + 20 * 60_000).toISOString()
const later = () => new Date(Date.now() + 8 * 3_600_000).toISOString()
const lock = (path: string, expires_at: string) => ({
  owner: 'alice',
  name: 'game',
  path,
  acquired_at: '2026-11-01T00:00:00Z',
  expires_at,
})
const notice = { id: 'n1', kind: 'x', detail: 'd', created_at: '2026-11-01T00:00:00Z' }

let locks: unknown[] = []
let pending: unknown[] = []
let notices: unknown[] = []
let signedIn = true
let broken = false
let calls: string[] = []

function server(url: string) {
  if (url === '/v1/session')
    return signedIn
      ? json({ user: 'alice', csrf_token: 'c' })
      : json({ code: 'x', message: 'x' }, 401)
  if (url === '/v1/me') return json({ user: 'alice', admin: false })
  if (url === '/v1/setup') return json({ initialised: true })
  if (url === '/v1/repos') return json(sampleRepos)
  if (url === '/v1/me/orgs') return json(orgs)
  if (url === '/v1/me/access-sessions') return json([])
  if (['/v1/me/locks', '/v1/me/invitations', '/v1/me/notices'].includes(url) && broken)
    return json({ code: 'internal', message: 'x' }, 500)
  if (url === '/v1/me/locks') return json(locks)
  if (url === '/v1/me/invitations') return json(pending)
  if (url === '/v1/me/notices') return json(notices)
  if (url.endsWith('/release')) {
    locks = []
    return new Response(null, { status: 204 })
  }
  if (url.endsWith('/decline')) return new Response(null, { status: 204 })
  if (url.endsWith('/accept')) {
    pending = []
    return json(orgs[0])
  }
  return json({ code: 'not_found', message: 'x' }, 404)
}

let apps: VueWrapper[] = []

beforeEach(() => {
  locks = []
  pending = []
  notices = []
  signedIn = true
  broken = false
  calls = []
  clearSessionData()
  resetTopBar()
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push(`${method} ${url}`)
      return Promise.resolve(server(url))
    }),
  )
})
afterEach(() => {
  apps.forEach((a) => a.unmount())
  apps = []
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function openApp(path = '/') {
  const router = makeRouter(createMemoryHistory())
  await router.push(path)
  const { default: App } = await import('../src/App.vue')
  const w = mount(App, { attachTo: document.body, global: { plugins: [router] } })
  apps.push(w as unknown as VueWrapper)
  await flushPromises()
  await flushPromises()
  return { w, router }
}

describe('top bar data', () => {
  it('feeds the owners, counts and extra destinations', async () => {
    locks = [lock('a.bin', soon()), lock('b.bin', later())]
    pending = invitations
    notices = [notice]
    const { w } = await openApp()
    const bar = w.findComponent(PynTopBar)
    expect(bar.props('owners')).toEqual(
      topBarOwners(
        'alice',
        [...orgs].sort((a, b) => a.name.localeCompare(b.name)),
      ),
    )
    expect(bar.props('locksHeld')).toBe(2)
    expect(bar.props('locksExpiring')).toBe(true)
    expect(bar.props('notifications')).toBe(invitations.length + 1)
    expect(bar.props('repos')).toEqual(sampleRepos.map((r) => `${r.owner}/${r.name}`))
    expect(bar.find('[data-locks]').text()).toContain('2')
    expect(bar.find('[data-bell] [data-badge]').text()).toBe(String(invitations.length + 1))
    expect(bar.find('[data-locks] span:not([aria-hidden])').text()).toMatch(/expir/i)
  })

  it('is not expiring when every lease has over an hour left, and hides empty counts', async () => {
    locks = [lock('a.bin', later())]
    const { w } = await openApp()
    const bar = w.findComponent(PynTopBar)
    expect(bar.props('locksExpiring')).toBe(false)
    locks = []
    await refreshTopBar()
    await flushPromises()
    expect(bar.find('[data-locks]').exists()).toBe(false)
    expect(bar.find('[data-badge]').exists()).toBe(false)
  })

  it('shows the current owner on an owner page and none elsewhere', async () => {
    const { w, router } = await openApp('/studio')
    expect(w.findComponent(PynTopBar).props('currentOwner')).toBe('studio')
    await router.push('/_/people')
    await flushPromises()
    expect(w.findComponent(PynTopBar).props('currentOwner')).toBeUndefined()
  })

  it('offers Explore in the signed-in menu', async () => {
    const { w } = await openApp()
    expect(w.findComponent(PynTopBar).props('extraLinks')).toContainEqual({
      id: 'explore',
      label: 'Explore',
      href: '/_/explore',
    })
  })

  it('gives the shell the full width only on the wide routes', async () => {
    const { w, router } = await openApp('/')
    expect(w.findComponent(PynShell).props('wide')).toBe(false)
    await router.push('/acme/game/blob/a.txt')
    await flushPromises()
    expect(w.findComponent(PynShell).props('wide')).toBe(true)
    await router.push('/acme/game/settings/policy')
    await flushPromises()
    expect(w.findComponent(PynShell).props('wide')).toBe(true)
    await router.push('/_/locks')
    await flushPromises()
    expect(w.findComponent(PynShell).props('wide')).toBe(false)
  })

  it('renders no side navigation outside the dashboard and keeps old destinations reachable', async () => {
    const { w, router } = await openApp()
    for (const p of ['/_/locks', '/acme/game', '/_/orgs'])
      expect(
        await router.push(p).then(() => w.findComponent(PynShell).vm.$slots.side),
      ).toBeUndefined()
    await w.find('[aria-label="Account menu"]').trigger('click')
    const hrefs = w.findAll('[role=menu] a').map((a) => a.attributes('href'))
    expect(hrefs).toEqual(
      expect.arrayContaining(['/_/locks', '/_/orgs', '/_/people', '/_/settings']),
    )
  })

  it('links the bell panel to invitations while some are pending', async () => {
    pending = invitations
    const { w } = await openApp()
    await w.find('button[data-bell]').trigger('click')
    expect(w.find('a[href="/_/invitations"]').exists()).toBe(true)
  })

  it('shows owner and repository on a repository page only', async () => {
    const { w, router } = await openApp('/acme/game')
    expect(w.findComponent(PynTopBar).props('repo')).toBe('game')
    await router.push('/_/people')
    await flushPromises()
    expect(w.findComponent(PynTopBar).props('repo')).toBeUndefined()
  })

  it('fetches the counts once per sign-in, not on route changes', async () => {
    const { router } = await openApp('/_/people')
    const n = () => calls.filter((c) => c === 'GET /v1/me/locks' || c === 'GET /v1/me/notices')
    expect(n()).toHaveLength(2)
    await router.push('/_/people')
    await router.push('/_/orgs')
    await flushPromises()
    expect(n()).toHaveLength(2)
  })

  it('shows zero, with no error, when the fetches fail', async () => {
    broken = true
    const { w } = await openApp('/_/people')
    const bar = w.findComponent(PynTopBar)
    expect(bar.props('locksHeld')).toBe(0)
    expect(bar.props('notifications')).toBe(0)
    expect(bar.find('[data-locks]').exists()).toBe(false)
    expect(w.find('[role=alert]').exists()).toBe(false)
  })
})

describe('signed-out bar', () => {
  it('shows brand, search and sign in, with no counts or account menu', async () => {
    signedIn = false
    const { w } = await openApp('/_/people')
    const bar = w.findComponent(PynTopBar)
    expect(bar.props('signedOut')).toBe(true)
    expect(bar.find('a[data-sign-in]').exists()).toBe(true)
    expect(bar.find('input').exists()).toBe(true)
    expect(bar.find('[aria-label="Account menu"]').exists()).toBe(false)
    expect(w.find('header ~ aside').exists()).toBe(false)
  })
})

describe('search routing', () => {
  const searchFor = async (text: string) => {
    const { w, router } = await openApp('/_/people')
    const input = w.findComponent(PynTopBar).find('input')
    await input.setValue(text)
    await input.trigger('keydown', { key: 'Enter' })
    await input.element.closest('form')?.dispatchEvent(new Event('submit', { cancelable: true }))
    await flushPromises()
    return router
  }

  it('opens a repository named in full', async () => {
    const router = await searchFor('alice/core-engine')
    expect(router.currentRoute.value.path).toBe('/alice/core-engine')
  })

  it('opens the command palette for other text, leaving the route alone', async () => {
    const router = await searchFor('zzz')
    expect(router.currentRoute.value.path).toBe('/_/people')
    expect(router.currentRoute.value.query.q).toBeUndefined()
    expect(document.querySelector('[role=dialog][aria-label="Command palette"]')).not.toBeNull()
  })
})

describe('count refresh', () => {
  it('drops the lock count after a release', async () => {
    locks = [lock('a.bin', later())]
    const { w } = await openApp('/_/locks')
    const bar = w.findComponent(PynTopBar)
    expect(bar.props('locksHeld')).toBe(1)
    const release = w.findAll('button').find((b) => /^release$/i.test(b.text().trim()))!
    await release.trigger('click')
    await flushPromises()
    expect(bar.props('locksHeld')).toBe(0)
  })

  it('drops the notification count after an invitation is accepted', async () => {
    pending = invitations
    const { w } = await openApp('/_/invitations')
    const bar = w.findComponent(PynTopBar)
    expect(bar.props('notifications')).toBe(invitations.length)
    const accept = w.findAll('button').find((b) => /accept/i.test(b.text()))!
    await accept.trigger('click')
    await flushPromises()
    expect(bar.props('notifications')).toBe(0)
  })
})
