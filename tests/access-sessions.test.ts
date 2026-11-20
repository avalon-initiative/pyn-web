import {
  PynAccessSessionBanner,
  PynAccessSessionHistory,
  PynAccessSessionList,
  PynAccessSessionStartForm,
  PynPeopleSearch,
  PynViewError,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { ApiError, describeError } from '../src/api/client'
import { makeRouter } from '../src/router'
import { clearOwnAccessSessions, ownAccessSessions } from '../src/state/access-session.state'
import { refreshOwnAccessSessions } from '../src/state/access-session.state'
import { sessionKey } from '../src/state/context.state'
import AdminAccessSessionsView from '../src/views/AdminAccessSessionsView.vue'
import AdminView from '../src/views/AdminView.vue'
import SecurityView from '../src/views/SecurityView.vue'

const reply = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), { status })

const info = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  admin: 'root',
  user: 'bob',
  reason: 'support_request',
  notes: null,
  started_at: '2026-11-20T10:00:00Z',
  expires_at: '2026-11-20T11:00:00Z',
  ended_at: null,
  state: 'active',
  reached: [],
  ...over,
})

function serve(routes: Record<string, (body: string) => Response>) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const make = routes[`${init?.method ?? 'GET'} ${url.split('?')[0]}`]
    return Promise.resolve(
      make ? make(String(init?.body ?? '')) : reply(404, { code: 'not_found', message: 'x' }),
    )
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const calls = (fn: ReturnType<typeof serve>, line: string) =>
  fn.mock.calls.filter((c) => `${c[1]?.method ?? 'GET'} ${String(c[0]).split('?')[0]}` === line)

const session = (admin: boolean) => ({
  global: {
    provide: { [sessionKey as symbol]: { user: ref('root'), admin: ref(admin), expire: () => {} } },
  },
})

beforeEach(clearOwnAccessSessions)
afterEach(() => vi.unstubAllGlobals())

describe('own access sessions banner state', () => {
  it('holds the sessions the server lists', async () => {
    serve({ 'GET /v1/me/access-sessions': () => reply(200, [info()]) })
    await refreshOwnAccessSessions()
    const w = mount(PynAccessSessionBanner, { props: { sessions: ownAccessSessions.value } })
    expect(ownAccessSessions.value).toHaveLength(1)
    expect(w.text()).not.toBe('')
  })

  it.each([
    ['an ended session', () => reply(200, [info({ state: 'ended' })])],
    ['an older server', () => reply(404, { code: 'not_found', message: 'x' })],
    ['a failure', () => reply(500, { code: 'error', message: 'boom' })],
  ])('shows no banner for %s', async (_, make) => {
    serve({ 'GET /v1/me/access-sessions': make })
    await refreshOwnAccessSessions()
    const w = mount(PynAccessSessionBanner, { props: { sessions: ownAccessSessions.value } })
    expect(w.text()).toBe('')
  })

  it('narrows unknown reasons and states', async () => {
    serve({ 'GET /v1/me/access-sessions': () => reply(200, [info({ reason: 'x', state: 'y' })]) })
    await refreshOwnAccessSessions()
    expect(ownAccessSessions.value[0]).toMatchObject({ reason: 'other', state: 'ended' })
  })
})

describe('security page history', () => {
  it('renders the history', async () => {
    serve({
      'GET /v1/me/access-sessions': () => reply(200, [info({ state: 'ended' })]),
    })
    const w = mount(SecurityView)
    await flushPromises()
    expect(w.findComponent(PynAccessSessionHistory).props('sessions')).toHaveLength(1)
  })

  it('shows a failure', async () => {
    serve({ 'GET /v1/me/access-sessions': () => reply(500, { code: 'error', message: 'boom' }) })
    const w = mount(SecurityView)
    await flushPromises()
    expect(w.findComponent(PynAccessSessionHistory).exists()).toBe(false)
    expect(w.findAllComponents(PynViewError).map((e) => e.text())).toContain('boom')
  })
})

describe('administrator access sessions', () => {
  const routes = {
    'GET /v1/admin/access-sessions': () => reply(200, [info()]),
    'POST /v1/admin/users/bob/access-sessions': () =>
      reply(201, { secret: 'pyn_secret', info: info() }),
    'POST /v1/admin/access-sessions/s1/end': () => reply(200, info({ state: 'ended' })),
  }

  it('has a route and a nav entry', async () => {
    expect(makeRouter(createMemoryHistory()).resolve('/_/admin/access-sessions').name).toBe(
      'admin-access-sessions',
    )
    serve({ 'GET /v1/admin/update': () => reply(404, null) })
    const router = makeRouter(createMemoryHistory())
    await router.push('/_/admin/access-sessions')
    await router.isReady()
    const w = mount(AdminView, {
      global: { ...session(true).global, plugins: [router] },
    })
    expect(w.html()).toContain('/_/admin/access-sessions')
  })

  it('starts for a chosen account, shows the secret once and clears it', async () => {
    const fn = serve(routes)
    const w = mount(AdminAccessSessionsView, session(true))
    await flushPromises()
    expect(w.findComponent(PynAccessSessionStartForm).exists()).toBe(false)
    w.findComponent(PynPeopleSearch).vm.$emit('search', ' bob ')
    await flushPromises()
    const form = w.findComponent(PynAccessSessionStartForm)
    expect(form.props('user')).toBe('bob')
    form.vm.$emit('submit', { reason: 'other', notes: ' looked at it ' })
    await flushPromises()
    const [, init] = calls(fn, 'POST /v1/admin/users/bob/access-sessions')[0]!
    expect(JSON.parse(String(init?.body))).toEqual({ reason: 'other', notes: 'looked at it' })
    expect(w.findComponent(PynAccessSessionList).props('started')?.secret).toBe('pyn_secret')
    w.findComponent(PynAccessSessionList).vm.$emit('dismiss')
    await flushPromises()
    expect(w.findComponent(PynAccessSessionList).props('started')).toBeUndefined()
    expect(w.text()).not.toContain('pyn_secret')
  })

  it('omits empty notes', async () => {
    const fn = serve(routes)
    const w = mount(AdminAccessSessionsView, session(true))
    await flushPromises()
    w.findComponent(PynPeopleSearch).vm.$emit('search', 'bob')
    await flushPromises()
    w.findComponent(PynAccessSessionStartForm).vm.$emit('submit', { reason: 'abuse_report' })
    await flushPromises()
    const [, init] = calls(fn, 'POST /v1/admin/users/bob/access-sessions')[0]!
    expect(JSON.parse(String(init?.body))).toEqual({ reason: 'abuse_report', notes: null })
  })

  it('ends a session and refreshes the list', async () => {
    let state = 'active'
    const fn = serve({
      ...routes,
      'GET /v1/admin/access-sessions': () => reply(200, [info({ state })]),
      'POST /v1/admin/access-sessions/s1/end': () => ((state = 'ended'), reply(200, info())),
    })
    const w = mount(AdminAccessSessionsView, session(true))
    await flushPromises()
    w.findComponent(PynAccessSessionList).vm.$emit('end', 's1')
    await flushPromises()
    expect(calls(fn, 'POST /v1/admin/access-sessions/s1/end')).toHaveLength(1)
    expect(calls(fn, 'GET /v1/admin/access-sessions')).toHaveLength(2)
    expect(w.findComponent(PynAccessSessionList).props('sessions')[0].state).toBe('ended')
  })

  it('shows a refused start', async () => {
    serve({
      ...routes,
      'POST /v1/admin/users/bob/access-sessions': () =>
        reply(404, { code: 'user_not_found', message: 'x' }),
    })
    const w = mount(AdminAccessSessionsView, session(true))
    await flushPromises()
    w.findComponent(PynPeopleSearch).vm.$emit('search', 'bob')
    await flushPromises()
    w.findComponent(PynAccessSessionStartForm).vm.$emit('submit', { reason: 'abuse_report' })
    await flushPromises()
    expect(w.findComponent(PynAccessSessionStartForm).props('error')).toBe(
      'That account does not exist.',
    )
  })
})

describe('non-administrators', () => {
  it('never call the admin endpoints', async () => {
    const fn = serve({ 'GET /v1/admin/update': () => reply(403, null) })
    const router = makeRouter(createMemoryHistory())
    await router.push('/_/admin/access-sessions')
    await router.isReady()
    mount(AdminView, {
      global: { ...session(false).global, plugins: [router], stubs: { RouterView: false } },
    })
    await flushPromises()
    expect(fn.mock.calls.filter((c) => String(c[0]).startsWith('/v1/admin'))).toEqual([])
  })
})

describe('friendly text for access session errors', () => {
  it.each([
    ['access_session_not_allowed', 'not open'],
    ['access_session_not_found', 'does not exist'],
    ['account_inactive', 'not active'],
    ['server_admin_required', 'administrator'],
  ])('words %s', (code, text) => {
    expect(describeError(new ApiError(403, code, 'raw'))).toContain(text)
  })
})
