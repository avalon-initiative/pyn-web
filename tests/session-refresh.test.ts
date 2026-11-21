import {
  PynOrgForm,
  PynOrgInvitations,
  PynOrgMembers,
  PynRepoDelete,
  PynRepoForm,
  PynTopBar,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { orgKey, repoKey, sessionKey } from '../src/state/context.state'
import { pendingInvitations } from '../src/state/invitations.state'
import {
  SESSION_FAST_MS,
  SESSION_SLOW_MS,
  clearSessionData,
  sessionOrgs,
  sessionRepos,
} from '../src/state/session-data.state'
import { useAccessSessions } from '../src/state/admin-access-sessions.state'
import { invitations, orgs } from './fixtures/org-data'
import InvitationsView from '../src/views/InvitationsView.vue'
import NewOrgView from '../src/views/NewOrgView.vue'
import NewRepoView from '../src/views/NewRepoView.vue'
import OrgMembersView from '../src/views/OrgMembersView.vue'
import RepoGeneralView from '../src/views/RepoGeneralView.vue'

const repo = { id: 'r', owner: 'alice', name: 'game', max_locks_per_user: 0 }
const session0 = {
  id: 'a1',
  actor: 'root',
  target: 'bob',
  reason: 'help',
  started_at: '2026-11-01T00:00:00Z',
  expires_at: '2026-11-01T01:00:00Z',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let calls: string[] = []
let signedIn = true
let apps: { unmount: () => void }[] = []

const server = (url: string, method: string) => {
  if (url === '/v1/session' && method === 'GET')
    return signedIn
      ? json({ user: 'alice', csrf_token: 'c' })
      : json({ code: 'x', message: 'x' }, 401)
  if (url === '/v1/session') return new Response(null, { status: 204 })
  if (url === '/v1/me') return json({ user: 'alice', admin: false })
  if (url === '/v1/setup') return json({ initialised: true })
  if (url === '/v1/me/invitations') return json(invitations)
  if (url === '/v1/me/orgs') return json(orgs)
  if (url === '/v1/repos') return json([])
  if (url === '/v1/me/access-sessions') return json([])
  if (url === '/v1/orgs' && method === 'POST') return json(orgs[0])
  if (url === '/v1/repos' && method === 'POST') return json(repo)
  if (url.endsWith('/access-sessions') && method === 'POST')
    return json({ secret: 's', info: session0 })
  if (url.endsWith('/end')) return json(session0)
  if (url === '/v1/admin/access-sessions') return json([])
  if (method === 'PUT' || method === 'PATCH') return json(repo)
  if (method !== 'GET') return new Response(null, { status: 204 })
  return json({ code: 'not_found', message: 'x' }, 404)
}

const stub = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push(`${method} ${url}`)
      return Promise.resolve(server(url, method))
    }),
  )

const count = (url: string) => calls.filter((c) => c === `GET ${url}`).length
const LISTS = ['/v1/me/access-sessions', '/v1/me/invitations', '/v1/repos', '/v1/me/orgs'] as const
const snapshot = () => LISTS.map(count)

beforeEach(() => {
  calls = []
  signedIn = true
  clearSessionData()
  stub()
})
afterEach(() => {
  apps.forEach((a) => a.unmount())
  apps = []
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function openApp() {
  const router = makeRouter(createMemoryHistory())
  await router.push('/_/keys')
  const { default: App } = await import('../src/App.vue')
  const w = mount(App, { attachTo: document.body, global: { plugins: [router] } })
  apps.push(w)
  await flushPromises()
  await flushPromises()
  return { w, router }
}

describe('session-level lists', () => {
  it('loads each list once after sign-in and not again on a route change', async () => {
    const { router } = await openApp()
    expect(snapshot()).toEqual([1, 1, 1, 1])
    await router.push('/_/password')
    await flushPromises()
    await router.push('/_/security')
    await flushPromises()
    await router.push('/_/keys')
    await flushPromises()
    expect(snapshot()).toEqual([1, 1, 1, 1])
    expect(sessionOrgs.value).toHaveLength(orgs.length)
    expect(pendingInvitations.value).toBe(invitations.length)
  })

  it('refreshes every list on window focus', async () => {
    await openApp()
    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(snapshot()).toEqual([2, 2, 2, 2])
  })

  it('refreshes the access sessions on the fast timer and the rest on the slow one', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    await openApp()
    vi.advanceTimersByTime(SESSION_FAST_MS)
    await flushPromises()
    expect(snapshot()).toEqual([2, 1, 1, 1])
    vi.advanceTimersByTime(SESSION_SLOW_MS - SESSION_FAST_MS)
    await flushPromises()
    expect(snapshot()).toEqual([6, 2, 2, 2])
  })

  it('clears the lists and stops refreshing on sign-out', async () => {
    const { w } = await openApp()
    expect(sessionOrgs.value.length).toBeGreaterThan(0)
    signedIn = false
    w.findComponent(PynTopBar).vm.$emit('signOut')
    await flushPromises()
    await flushPromises()
    expect(sessionOrgs.value).toEqual([])
    expect(sessionRepos.value).toEqual([])
    expect(pendingInvitations.value).toBe(0)
    const before = snapshot()
    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(snapshot()).toEqual(before)
  })
})

describe('mutations refresh the list they change', () => {
  const router = () => makeRouter(createMemoryHistory())
  const session = { user: ref('alice'), admin: ref(false), expire: () => {} }

  it('creating an organization refreshes the organizations', async () => {
    const w = mount(NewOrgView, {
      global: { plugins: [router()], provide: { [sessionKey as symbol]: session } },
    })
    w.findComponent(PynOrgForm).vm.$emit('submit', 'studio')
    await flushPromises()
    expect(calls).toContain('POST /v1/orgs')
    expect(snapshot()).toEqual([0, 0, 0, 1])
  })

  it('creating a repository refreshes the repositories', async () => {
    const w = mount(NewRepoView, {
      global: { plugins: [router()], provide: { [sessionKey as symbol]: session } },
    })
    await flushPromises()
    w.findComponent(PynRepoForm).vm.$emit('submit', { name: 'game' })
    await flushPromises()
    expect(calls).toContain('POST /v1/repos')
    expect(count('/v1/repos')).toBe(1)
  })

  const general = () =>
    mount(RepoGeneralView, {
      global: {
        plugins: [router()],
        provide: {
          [sessionKey as symbol]: session,
          [repoKey as symbol]: {
            target: computed(() => ({ owner: 'alice', name: 'game' })),
            repo: ref({ id: 'r', owner: 'alice', name: 'game', max_locks_per_user: 0 }),
            permissions: ref([]),
            org: ref(null),
            frozen: ref(false),
            reload: async () => {},
          },
        },
      },
    })

  it('deleting a repository refreshes the repositories', async () => {
    const w = general()
    w.findComponent(PynRepoDelete).vm.$emit('remove')
    await flushPromises()
    expect(calls).toContain('DELETE /v1/repos/alice/game')
    expect(count('/v1/repos')).toBe(1)
  })

  it('saving repository settings refreshes the repositories', async () => {
    const w = general()
    w.findComponent(PynRepoForm).vm.$emit('submit', { name: 'game' })
    await flushPromises()
    expect(count('/v1/repos')).toBe(1)
  })

  it('accepting an invitation refreshes invitations, organizations and repositories', async () => {
    const w = mount(InvitationsView, { global: { plugins: [router()] } })
    await flushPromises()
    calls = []
    w.findComponent(PynOrgInvitations).vm.$emit('accept', 'studio')
    await flushPromises()
    expect(snapshot()).toEqual([0, 1, 1, 1])
  })

  it('declining an invitation refreshes the invitation count only', async () => {
    const w = mount(InvitationsView, { global: { plugins: [router()] } })
    await flushPromises()
    calls = []
    w.findComponent(PynOrgInvitations).vm.$emit('decline', 'studio')
    await flushPromises()
    expect(snapshot()).toEqual([0, 2, 0, 0])
  })

  it('leaving an organization refreshes the organizations', async () => {
    const ctx = {
      name: computed(() => 'studio'),
      org: ref(orgs[0]),
      frozen: ref(false),
      reload: async () => {},
    }
    const w = mount(OrgMembersView, {
      global: {
        plugins: [router()],
        provide: { [sessionKey as symbol]: session, [orgKey as symbol]: ctx },
      },
    })
    await flushPromises()
    calls = []
    w.findComponent(PynOrgMembers).vm.$emit('remove', 'alice')
    await flushPromises()
    expect(calls).toContain('DELETE /v1/orgs/studio/members/alice')
    expect(count('/v1/me/orgs')).toBe(1)
  })

  it('starting and ending an access session refreshes the banner list', async () => {
    const s = useAccessSessions()
    await s.start('bob', { reason: 'help', minutes: 15 } as never)
    expect(count('/v1/me/access-sessions')).toBe(1)
    await s.end('abc')
    expect(count('/v1/me/access-sessions')).toBe(2)
  })
})
