import { PynSecondFactor, PynSecurityNotice } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { resetSecurityNotice } from '../src/state/security-notice.state'
import { useSecurity } from '../src/state/security.state'
import { onEnrolmentRequired, twoFactorDue } from '../src/state/two-factor.state'

const reply = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), { status })
type Routes = Record<string, () => Response>

function serve(routes: Routes) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const make = routes[`${init?.method ?? 'GET'} ${url.split('?')[0]}`]
    return Promise.resolve(make ? make() : reply(404, { code: 'not_found', message: 'x' }))
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const off = { enabled: false, factors: [], recovery_codes_left: 0 }
const on = { ...off, enabled: true, recovery_codes_left: 9 }
const due = { by: 'organization', organization: 'acme', deadline: '2026-12-01T00:00:00Z' }
const idle = { window_days: 30, pending: false, purge_at: null, scheduled_at: null, user: 'wendy' }
const base: Routes = {
  'GET /v1/setup': () => reply(200, { initialised: true }),
  'GET /v1/registration': () => reply(200, { registration: 'closed' }),
  'GET /v1/sign-in-options': () => reply(200, { password: true }),
  'GET /v1/session': () => reply(200, { user: 'wendy', csrf_token: 't', expires_at: 'x' }),
  'GET /v1/account/deletion': () => reply(200, idle),
  'GET /v1/me': () => reply(200, { id: 'a', user: 'wendy' }),
  'GET /v1/repos': () => reply(200, []),
  'GET /v1/orgs': () => reply(200, []),
  'GET /v1/invitations': () => reply(200, []),
  'GET /v1/me/two-factor': () => reply(200, off),
}

async function open(path = '/') {
  const router = makeRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const { default: App } = await import('../src/App.vue')
  const w = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  return { w, router }
}

beforeEach(() => resetSecurityNotice())
afterEach(() => {
  vi.unstubAllGlobals()
  onEnrolmentRequired(null)
  twoFactorDue.value = null
  resetSecurityNotice()
})

describe('two-factor notice under the top bar', () => {
  it('is hidden once a second factor exists', async () => {
    serve({ ...base, 'GET /v1/me/two-factor': () => reply(200, on) })
    const { w } = await open()
    expect(w.findComponent(PynSecurityNotice).exists()).toBe(false)
  })

  it('advises an account without one, links to the security settings and can be dismissed', async () => {
    serve(base)
    const { w } = await open()
    const notice = w.findComponent(PynSecurityNotice)
    expect(notice.props()).toMatchObject({
      required: false,
      dismissible: true,
      actionHref: '/_/settings/security',
    })
    expect(notice.find('a[href="/_/settings/security"]').exists()).toBe(true)
    await notice.find('button[aria-label=Dismiss]').trigger('click')
    expect(w.findComponent(PynSecurityNotice).exists()).toBe(false)
    expect(sessionStorage.getItem('pyn.security-notice.dismissed')).toBe('1')
  })

  it('stays dismissed for the rest of the session', async () => {
    sessionStorage.setItem('pyn.security-notice.dismissed', '1')
    serve(base)
    const { w } = await open()
    expect(w.findComponent(PynSecurityNotice).exists()).toBe(false)
  })

  it('uses the required wording, with the deadline, and cannot be dismissed', async () => {
    sessionStorage.setItem('pyn.security-notice.dismissed', '1')
    serve({
      ...base,
      'GET /v1/me': () => reply(200, { id: 'a', user: 'wendy', two_factor_required: due }),
    })
    const { w } = await open()
    const notice = w.findComponent(PynSecurityNotice)
    expect(notice.props('required')).toBe(true)
    expect(notice.props('message')).toContain('The organization acme requires')
    expect(notice.props('deadline')).toContain('Dec 01 2026')
    expect(notice.find('button[aria-label=Dismiss]').exists()).toBe(false)
  })

  it('goes away after a factor is enrolled', async () => {
    let status: object = off
    serve({ ...base, 'GET /v1/me/two-factor': () => reply(200, status) })
    const { w } = await open()
    expect(w.findComponent(PynSecurityNotice).exists()).toBe(true)
    status = on
    await useSecurity().load()
    await flushPromises()
    expect(w.findComponent(PynSecurityNotice).exists()).toBe(false)
  })

  it('comes back after the last factor is removed', async () => {
    let status: object = on
    serve({
      ...base,
      'GET /v1/me/two-factor': () => reply(200, status),
      'DELETE /v1/me/two-factor/f1': () => reply(204, null),
    })
    const { w } = await open()
    expect(w.findComponent(PynSecurityNotice).exists()).toBe(false)
    status = off
    await useSecurity().removeTotp('f1')
    await flushPromises()
    expect(w.findComponent(PynSecurityNotice).exists()).toBe(true)
  })

  it('reads the status once per sign-in, not per route', async () => {
    const fn = serve(base)
    const { router } = await open()
    await router.push('/_/people')
    await router.push('/_/locks')
    await flushPromises()
    const reads = fn.mock.calls.filter((c) => c[0] === '/v1/me/two-factor')
    expect(reads).toHaveLength(1)
  })

  it('stays silent when the status call fails', async () => {
    serve({ ...base, 'GET /v1/me/two-factor': () => reply(500, { code: 'x', message: 'x' }) })
    const { w } = await open()
    expect(w.findComponent(PynSecurityNotice).exists()).toBe(false)
  })

  it('is not shown on the security page itself', async () => {
    serve(base)
    const { w } = await open('/_/settings/security')
    expect(w.findComponent(PynSecurityNotice).exists()).toBe(false)
  })
})

describe('second-factor prompt hints', () => {
  it('says where recovery codes were shown and who can help', async () => {
    serve({
      ...base,
      'GET /v1/session': () => reply(401, { code: 'unauthenticated', message: 'x' }),
      'POST /v1/session': () => reply(401, { code: 'second_factor_required', message: 'x' }),
    })
    const { w } = await open()
    await w.find('input[name=username], input[autocomplete=username]').setValue('wendy')
    await w.find('input[type=password]').setValue('pw')
    await w.find('form').trigger('submit')
    await flushPromises()
    const prompt = w.findComponent(PynSecondFactor)
    expect(prompt.props('recoveryHint')).toMatch(/Recovery codes were shown once/)
    expect(prompt.props('helpHint')).toMatch(/server administrator with access to the server host/)
  })
})
