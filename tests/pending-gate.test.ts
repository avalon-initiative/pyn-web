import { PynAccountPendingDeletion, PynSignIn } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { failure } from '../src/api/http'
import { makeRouter } from '../src/router'
import { onPendingDeletion } from '../src/state/pending.state'

const reply = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), { status })
const refused = () =>
  reply(403, { code: 'account_pending_deletion', message: 'deletes on 2026-12-15' })
const pending = {
  pending: true,
  purge_at: '2026-12-15T00:00:00Z',
  scheduled_at: null,
  user: 'wendy',
}
const idle = { pending: false, purge_at: null, scheduled_at: null, user: 'wendy' }

type Routes = Record<string, () => Response>

function serve(routes: Routes) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const make = routes[`${init?.method ?? 'GET'} ${url.split('?')[0]}`]
    return Promise.resolve(make ? make() : reply(404, { code: 'not_found', message: 'x' }))
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const calls = (fn: ReturnType<typeof serve>, line: string) =>
  fn.mock.calls.filter((c) => `${c[1]?.method ?? 'GET'} ${c[0]}` === line).length

async function open() {
  const router = makeRouter(createMemoryHistory())
  await router.push('/')
  await router.isReady()
  const { default: App } = await import('../src/App.vue')
  const w = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  return w
}

const base: Routes = {
  'GET /v1/setup': () => reply(200, { initialised: true }),
  'GET /v1/registration': () => reply(200, { registration: 'closed' }),
  'GET /v1/session': () => reply(200, { user: 'wendy', csrf_token: 't' }),
  'GET /v1/me': () => reply(200, { id: 'a', user: 'wendy', admin: false }),
  'GET /v1/repos': () => reply(200, []),
  'GET /v1/orgs': () => reply(200, []),
  'GET /v1/invitations': () => reply(200, []),
}

afterEach(() => {
  vi.unstubAllGlobals()
  onPendingDeletion(null)
})

describe('pending-deletion gate', () => {
  it('shows the pending page after a restored session, with one status request', async () => {
    const fn = serve({ ...base, 'GET /v1/account/deletion': () => reply(200, pending) })
    const w = await open()
    const page = w.findComponent(PynAccountPendingDeletion)
    expect(page.props('deadline')).toBe(pending.purge_at)
    expect(page.props('user')).toBe('wendy')
    expect(calls(fn, 'GET /v1/account/deletion')).toBe(1)
    expect(calls(fn, 'GET /v1/me')).toBe(0)
  })

  it('enters the app when nothing is scheduled', async () => {
    const fn = serve({ ...base, 'GET /v1/account/deletion': () => reply(200, idle) })
    const w = await open()
    expect(w.findComponent(PynAccountPendingDeletion).exists()).toBe(false)
    expect(calls(fn, 'GET /v1/me')).toBe(1)
  })

  it('checks the status on sign-in and gates a pending account', async () => {
    const fn = serve({
      ...base,
      'GET /v1/session': () => reply(401, { code: 'unauthenticated', message: 'x' }),
      'POST /v1/session': () => reply(200, { user: 'wendy', csrf_token: 't' }),
      'GET /v1/account/deletion': () => reply(200, pending),
    })
    const w = await open()
    w.findComponent(PynSignIn).vm.$emit('sign-in', { username: 'wendy', password: 'pw' })
    await flushPromises()
    expect(calls(fn, 'GET /v1/account/deletion')).toBe(1)
    expect(w.findComponent(PynAccountPendingDeletion).exists()).toBe(true)
  })

  it('restores the account, then re-enters the app', async () => {
    let restored = false
    const fn = serve({
      ...base,
      'GET /v1/account/deletion': () => reply(200, restored ? idle : pending),
      'POST /v1/account/deletion/restore': () => ((restored = true), reply(200, idle)),
    })
    const w = await open()
    w.findComponent(PynAccountPendingDeletion).vm.$emit('restore')
    await flushPromises()
    expect(calls(fn, 'POST /v1/account/deletion/restore')).toBe(1)
    expect(w.findComponent(PynAccountPendingDeletion).exists()).toBe(false)
    expect(calls(fn, 'GET /v1/me')).toBe(1)
  })

  it('shows the pending page when any call is refused mid-session', async () => {
    let scheduled = false
    serve({
      ...base,
      'GET /v1/repos': () => (scheduled ? refused() : reply(200, [])),
      'GET /v1/account/deletion': () => reply(200, scheduled ? pending : idle),
    })
    const w = await open()
    expect(w.findComponent(PynAccountPendingDeletion).exists()).toBe(false)
    scheduled = true
    await failure(refused())
    await flushPromises()
    const page = w.findComponent(PynAccountPendingDeletion)
    expect(page.exists()).toBe(true)
    expect(page.props('deadline')).toBe(pending.purge_at)
  })

  it('ignores other refusals', async () => {
    const fn = serve({ ...base, 'GET /v1/account/deletion': () => reply(200, idle) })
    const w = await open()
    await failure(reply(403, { code: 'server_admin_required', message: 'x' }))
    await flushPromises()
    expect(calls(fn, 'GET /v1/account/deletion')).toBe(1)
    expect(w.findComponent(PynAccountPendingDeletion).exists()).toBe(false)
  })
})
