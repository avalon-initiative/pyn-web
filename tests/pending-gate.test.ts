import {
  PynAccountDelete,
  PynAccountPendingDeletion,
  PynSignIn,
  PynTopBar,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { failure } from '../src/api/http'
import { makeRouter } from '../src/router'
import { onPendingDeletion } from '../src/state/pending.state'
import { ownProfile } from '../src/state/own-profile.state'

const reply = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), { status })
const refused = () =>
  reply(403, { code: 'account_pending_deletion', message: 'deletes on 2026-12-15' })
const pending = {
  window_days: 30,
  pending: true,
  purge_at: '2026-12-15T00:00:00Z',
  scheduled_at: null,
  user: 'wendy',
}
const idle = { window_days: 30, pending: false, purge_at: null, scheduled_at: null, user: 'wendy' }

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

  it('hands the recovery window to the delete page without another status request', async () => {
    const fn = serve({
      ...base,
      'GET /v1/account/deletion': () => reply(200, { ...idle, window_days: 14 }),
    })
    const router = makeRouter(createMemoryHistory())
    await router.push('/_/settings/delete')
    await router.isReady()
    const { default: App } = await import('../src/App.vue')
    const w = mount(App, { global: { plugins: [router] } })
    await flushPromises()
    expect(w.findComponent(PynAccountDelete).props('recoveryDays')).toBe(14)
    expect(calls(fn, 'GET /v1/account/deletion')).toBe(1)
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

describe('own identity in the shell', () => {
  const profile = { display_name: 'Wendy W', avatar_url: '/v1/users/wendy/avatar?v=1' }
  const withProfile = {
    ...base,
    'GET /v1/me': () => reply(200, { id: 'a', user: 'wendy', admin: false, profile }),
    'GET /v1/account/deletion': () => reply(200, idle),
  }

  it('passes the display name and avatar to the top bar', async () => {
    serve(withProfile)
    const w = await open()
    const part = w.findComponent(PynTopBar)
    expect(part.props('displayName')).toBe('Wendy W')
    expect(part.props('avatarUrl')).toBe(profile.avatar_url)
  })

  it('falls back to the account name when the profile cannot load', async () => {
    serve({ ...withProfile, 'GET /v1/me': () => reply(500, { code: 'x', message: 'x' }) })
    const w = await open()
    expect(w.findComponent(PynTopBar).props('displayName')).toBeUndefined()
    expect(w.findComponent(PynTopBar).props('user')).toBe('wendy')
  })

  it('follows the profile page', async () => {
    serve(withProfile)
    const w = await open()
    ownProfile.value = { display_name: 'New Name', avatar_url: null }
    await flushPromises()
    expect(w.findComponent(PynTopBar).props('displayName')).toBe('New Name')
  })

  it('makes no profile request for a pending account', async () => {
    const fn = serve({ ...withProfile, 'GET /v1/account/deletion': () => reply(200, pending) })
    await open()
    expect(calls(fn, 'GET /v1/me')).toBe(0)
    expect(ownProfile.value).toEqual({})
  })
})
