import { PynSecondFactor, PynSignIn, PynTwoFactorNag } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { freshPrompt } from '../src/state/fresh.state'
import { onEnrolmentRequired, twoFactorDue } from '../src/state/two-factor.state'

const reply = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), { status })
type Routes = Record<string, (body: string) => Response>

function serve(routes: Routes) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const make = routes[`${init?.method ?? 'GET'} ${url.split('?')[0]}`]
    return Promise.resolve(
      make ? make(String(init?.body ?? '')) : reply(404, { code: 'not_found', message: 'x' }),
    )
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const sent = (fn: ReturnType<typeof serve>, line: string) =>
  fn.mock.calls
    .filter((c) => `${c[1]?.method ?? 'GET'} ${c[0]}` === line)
    .map((c) => JSON.parse(String(c[1]?.body)))

const session = { user: 'wendy', csrf_token: 't', expires_at: 'x' }
const idle = { window_days: 30, pending: false, purge_at: null, scheduled_at: null, user: 'wendy' }
const base: Routes = {
  'GET /v1/setup': () => reply(200, { initialised: true }),
  'GET /v1/registration': () => reply(200, { registration: 'closed' }),
  'GET /v1/sign-in-options': () => reply(200, { password: true, passkeys: true }),
  'GET /v1/session': () => reply(401, { code: 'unauthenticated', message: 'x' }),
  'GET /v1/account/deletion': () => reply(200, idle),
  'GET /v1/me': () => reply(200, { id: 'a', user: 'wendy' }),
  'GET /v1/repos': () => reply(200, []),
  'GET /v1/orgs': () => reply(200, []),
  'GET /v1/invitations': () => reply(200, []),
}
const needsCode = () => reply(401, { code: 'second_factor_required', message: 'x' })

async function open(path = '/') {
  const router = makeRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const { default: App } = await import('../src/App.vue')
  const w = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  return { w, router }
}

afterEach(() => {
  vi.unstubAllGlobals()
  onEnrolmentRequired(null)
  twoFactorDue.value = null
  freshPrompt.value = null
})

describe('second-factor sign-in', () => {
  it('asks for a code after the password and signs in with it', async () => {
    const fn = serve({
      ...base,
      'POST /v1/session': (b) => (JSON.parse(b).code ? reply(200, session) : needsCode()),
    })
    const { w } = await open()
    w.findComponent(PynSignIn).vm.$emit('sign-in', { username: 'wendy', password: 'pw' })
    await flushPromises()
    expect(w.findComponent(PynSignIn).exists()).toBe(false)
    w.findComponent(PynSecondFactor).vm.$emit('submit', { kind: 'totp', code: ' 123456 ' })
    await flushPromises()
    expect(sent(fn, 'POST /v1/session').at(-1)).toMatchObject({ password: 'pw', code: '123456' })
    expect(w.findComponent(PynSecondFactor).exists()).toBe(false)
  })

  it('keeps the challenge and shows the error for a wrong code', async () => {
    serve({
      ...base,
      'POST /v1/session': (b) =>
        JSON.parse(b).code
          ? reply(401, { code: 'second_factor_invalid', message: 'bad code' })
          : needsCode(),
    })
    const { w } = await open()
    w.findComponent(PynSignIn).vm.$emit('sign-in', { username: 'wendy', password: 'pw' })
    await flushPromises()
    w.findComponent(PynSecondFactor).vm.$emit('submit', { kind: 'recovery', code: 'x' })
    await flushPromises()
    expect(w.findComponent(PynSecondFactor).props('error')).toContain('not right')
  })

  it('goes back to the form on cancel', async () => {
    serve({ ...base, 'POST /v1/session': needsCode })
    const { w } = await open()
    w.findComponent(PynSignIn).vm.$emit('sign-in', { username: 'wendy', password: 'pw' })
    await flushPromises()
    w.findComponent(PynSecondFactor).vm.$emit('cancel')
    await flushPromises()
    expect(w.findComponent(PynSignIn).exists()).toBe(true)
  })
})

describe('passkey sign-in', () => {
  const begun = {
    ceremony: 'c1',
    expires_at: 'x',
    public_key: {
      challenge: 'AQ',
      timeout: 1,
      rpId: 'h',
      allowCredentials: [],
      userVerification: 'required',
    },
  }

  function stubBrowser() {
    vi.stubGlobal('PublicKeyCredential', {})
    const get = vi.fn(async () => ({ toJSON: () => ({ id: 'cred', response: {} }) }))
    vi.stubGlobal('navigator', { credentials: { get } })
  }

  it('offers the button only when the server and the browser can', async () => {
    stubBrowser()
    serve(base)
    expect((await open()).w.findComponent(PynSignIn).props('passkeys')).toBe(true)
    serve({
      ...base,
      'GET /v1/sign-in-options': () => reply(200, { password: true, passkeys: false }),
    })
    expect((await open()).w.findComponent(PynSignIn).props('passkeys')).toBe(false)
  })

  it('runs the ceremony and enters the app', async () => {
    stubBrowser()
    const fn = serve({
      ...base,
      'POST /v1/session/passkey/begin': () => reply(200, begun),
      'POST /v1/session/passkey/finish': () => reply(200, session),
    })
    const { w } = await open()
    w.findComponent(PynSignIn).vm.$emit('passkey')
    await flushPromises()
    expect(sent(fn, 'POST /v1/session/passkey/begin')[0]).toEqual({ username: null })
    expect(sent(fn, 'POST /v1/session/passkey/finish')[0]).toEqual({
      ceremony: 'c1',
      credential: { id: 'cred', response: {} },
    })
    expect(w.findComponent(PynSignIn).exists()).toBe(false)
  })

  it('shows a friendly error when the prompt is dismissed', async () => {
    vi.stubGlobal('PublicKeyCredential', {})
    vi.stubGlobal('navigator', {
      credentials: {
        get: vi.fn(async () => {
          throw new DOMException('x', 'NotAllowedError')
        }),
      },
    })
    serve({ ...base, 'POST /v1/session/passkey/begin': () => reply(200, begun) })
    const { w } = await open()
    w.findComponent(PynSignIn).vm.$emit('passkey')
    await flushPromises()
    expect(w.findComponent(PynSignIn).props('error')).toContain('cancelled')
  })
})

describe('enforcement', () => {
  const due = { by: 'server', deadline: '2026-12-01T00:00:00Z', enforced: false }
  const signedIn = { ...base, 'GET /v1/session': () => reply(200, session) }

  it('nags from /v1/me until the security page is open', async () => {
    serve({
      ...signedIn,
      'GET /v1/me': () => reply(200, { id: 'a', user: 'wendy', two_factor_required: due }),
    })
    const { w } = await open()
    expect(w.findComponent(PynTwoFactorNag).props('required')).toMatchObject({ by: 'server' })
    expect(w.find('a[href="/_/settings/security"]').exists()).toBe(true)
  })

  it('redirects to the security page when the server demands enrolment', async () => {
    serve({
      ...signedIn,
      'GET /v1/me': () => reply(403, { code: 'two_factor_enrolment_required', message: 'x' }),
      'GET /v1/me/two-factor': () =>
        reply(200, {
          enabled: false,
          factors: [],
          recovery_codes_left: 0,
          required: { ...due, enforced: true },
        }),
      'GET /v1/me/notices': () => reply(200, []),
    })
    const { router } = await open()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/_/settings/security')
    expect(twoFactorDue.value?.enforced).toBe(true)
  })
})

describe('fresh check prompt', () => {
  it('verifies the code and settles the prompt', async () => {
    const fn = serve({
      ...base,
      'GET /v1/session': () => reply(200, session),
      'GET /v1/me/two-factor': () =>
        reply(200, {
          enabled: true,
          factors: [],
          recovery_codes_left: 1,
          passkeys_available: false,
        }),
      'POST /v1/me/two-factor/verify': () => reply(200, { fresh_until: 'x' }),
    })
    const { w } = await open()
    const { requestFresh } = await import('../src/state/fresh.state')
    const done = requestFresh()
    await flushPromises()
    w.findComponent(PynSecondFactor).vm.$emit('submit', { kind: 'totp', code: '654321' })
    await flushPromises()
    expect(await done).toBe(true)
    expect(sent(fn, 'POST /v1/me/two-factor/verify')[0]).toEqual({ code: '654321' })
    expect(w.findComponent(PynSecondFactor).exists()).toBe(false)
  })
})
