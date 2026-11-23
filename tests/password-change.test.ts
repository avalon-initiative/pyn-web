import { PynPasswordForm, PynSignIn } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { PASSWORD_CHANGE_REASON, passwordChangeRequired } from '../src/state/password-change.state'
import PasswordView from '../src/views/PasswordView.vue'

const reply = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), { status })

type Routes = Record<string, () => Response>

function serve(routes: Routes) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const make = routes[`${init?.method ?? 'GET'} ${url.split('?')[0]}`]
      return Promise.resolve(make ? make() : reply(404, { code: 'not_found', message: 'x' }))
    }),
  )
}

const session = (extra = {}) => ({ user: 'wendy', csrf_token: 't', ...extra })
const base: Routes = {
  'GET /v1/setup': () => reply(200, { initialised: true }),
  'GET /v1/registration': () => reply(200, { registration: 'closed' }),
  'GET /v1/sign-in-options': () => reply(200, { password: true }),
  'GET /v1/account/deletion': () =>
    reply(200, { window_days: 30, pending: false, purge_at: null, user: 'wendy' }),
  'GET /v1/me': () => reply(200, { id: 'a', user: 'wendy', admin: false, has_password: true }),
  'GET /v1/repos': () => reply(200, []),
  'GET /v1/me/orgs': () => reply(200, []),
  'GET /v1/me/invitations': () => reply(200, []),
}

async function open(path = '/_/orgs') {
  const router = makeRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const { default: App } = await import('../src/App.vue')
  const w = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  return { w, router }
}

beforeEach(() => {
  passwordChangeRequired.value = false
})
afterEach(() => vi.unstubAllGlobals())

describe('password change after an administrator set the password', () => {
  it('sends a restored session to the password page with the reason', async () => {
    serve({
      ...base,
      'GET /v1/session': () => reply(200, session({ password_change_required: true })),
    })
    const { w, router } = await open()
    expect(router.currentRoute.value.path).toBe('/_/settings/password')
    expect(w.findComponent(PynPasswordForm).props('reason')).toBe(PASSWORD_CHANGE_REASON)
  })

  it('sends a fresh sign-in there too', async () => {
    serve({
      ...base,
      'GET /v1/session': () => reply(401, { code: 'unauthenticated', message: 'x' }),
      'POST /v1/session': () => reply(200, session({ password_change_required: true })),
    })
    const { w, router } = await open('/')
    w.findComponent(PynSignIn).vm.$emit('signIn', { username: 'wendy', password: 'one-time-pw1' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/_/settings/password')
  })

  it('redirects every other page back until the password is changed', async () => {
    serve({
      ...base,
      'GET /v1/session': () => reply(200, session({ password_change_required: true })),
    })
    const { router } = await open()
    for (const path of ['/', '/_/orgs', '/_/admin/accounts', '/alice/game', '/nowhere/at/all']) {
      await router.push(path)
      expect(router.currentRoute.value.path).toBe('/_/settings/password')
    }
  })

  it('leaves a normal session alone', async () => {
    serve({ ...base, 'GET /v1/session': () => reply(200, session()) })
    const { router } = await open()
    expect(router.currentRoute.value.path).toBe('/_/orgs')
    expect(passwordChangeRequired.value).toBe(false)
  })

  it('clears after a successful change, then other pages open', async () => {
    serve({
      ...base,
      'PUT /v1/me/password': () => reply(204, null),
    })
    passwordChangeRequired.value = true
    const router = makeRouter(createMemoryHistory())
    await router.push('/_/settings/password')
    const w = mount(PasswordView, { global: { plugins: [router] } })
    await flushPromises()
    expect(w.findComponent(PynPasswordForm).props('reason')).toBe(PASSWORD_CHANGE_REASON)
    w.findComponent(PynPasswordForm).vm.$emit('submit', {
      current: 'one-time-pw1',
      next: 'my-own-password',
    })
    await flushPromises()
    expect(passwordChangeRequired.value).toBe(false)
    expect(w.findComponent(PynPasswordForm).props('reason')).toBeUndefined()
    await router.push('/_/orgs')
    expect(router.currentRoute.value.path).toBe('/_/orgs')
  })

  it('stays flagged when the change is refused', async () => {
    serve({
      ...base,
      'PUT /v1/me/password': () => reply(401, { code: 'unauthenticated', message: 'x' }),
    })
    passwordChangeRequired.value = true
    const w = mount(PasswordView)
    await flushPromises()
    w.findComponent(PynPasswordForm).vm.$emit('submit', {
      current: 'wrong',
      next: 'my-own-password',
    })
    await flushPromises()
    expect(passwordChangeRequired.value).toBe(true)
  })
})
