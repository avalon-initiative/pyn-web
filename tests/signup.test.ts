import { PynSignIn, externalSignInUrl, signInErrorMessage } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { register, resendVerification, signIn, verifyEmail } from '../src/api/auth'
import { ApiError, describeError } from '../src/api/client'
import { makeRouter } from '../src/router'
import { blockedStatus } from '../src/state/account.state'
import { nameProblem } from '../src/state/name.state'

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers })

afterEach(() => vi.unstubAllGlobals())

describe('account api', () => {
  it('registers with the email and reports the status', async () => {
    const fn = vi
      .fn()
      .mockImplementation(async () => reply(201, { user: 'wendy', status: 'pending_verification' }))
    vi.stubGlobal('fetch', fn)
    const out = await register({ username: 'wendy', password: 'pw', email: 'w@example.com' })
    expect(out.status).toBe('pending_verification')
    expect(JSON.parse(fn.mock.calls[0][1].body)).toMatchObject({ email: 'w@example.com' })
  })

  it('posts the token and the resend address', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(reply(200, { user: 'wendy', status: 'active' }))
      .mockResolvedValueOnce(reply(202, null))
    vi.stubGlobal('fetch', fn)
    expect((await verifyEmail('tok')).user).toBe('wendy')
    await resendVerification('w@example.com')
    expect(fn.mock.calls[0][0]).toBe('/v1/register/verify')
    expect(JSON.parse(fn.mock.calls[1][1].body)).toEqual({ email: 'w@example.com' })
  })

  it('keeps Retry-After on a rate-limited sign-in and words it for the page', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          reply(429, { code: 'too_many_attempts', message: 'x' }, { 'Retry-After': '780' }),
        ),
    )
    const e = await signIn({ username: 'a', password: 'b' }).catch((x) => x)
    expect(e).toMatchObject({ status: 429, retryAfter: 780 })
    expect(describeError(e)).toBe('Too many attempts. Try again in 13 minutes.')
  })

  it('maps the refused sign-in codes to account states', () => {
    const refused = (code: string, status = 403) => blockedStatus(new ApiError(status, code, 'x'))
    expect(refused('email_not_verified')).toBe('pending_verification')
    expect(refused('approval_pending')).toBe('pending_approval')
    expect(refused('account_disabled')).toBe('account_disabled')
    expect(refused('authentication_failed', 401)).toBeNull()
    expect(blockedStatus(new Error('x'))).toBeNull()
  })
})

describe('VerifyEmailView', () => {
  const open = async (url: string) => {
    const router = makeRouter(createMemoryHistory())
    await router.push(url)
    await router.isReady()
    const { default: App } = await import('../src/App.vue')
    const w = mount(App, { global: { plugins: [router] } })
    await flushPromises()
    return w
  }

  it('verifies the token from the link, signed out', async () => {
    const fn = vi.fn((url: string, _init?: RequestInit) =>
      Promise.resolve(
        url === '/v1/register/verify'
          ? reply(200, { user: 'wendy', status: 'pending_approval' })
          : reply(401, { code: 'unauthenticated', message: 'x' }),
      ),
    )
    vi.stubGlobal('fetch', fn)
    const w = await open('/verify-email?token=abc')
    const call = fn.mock.calls.find((c) => c[0] === '/v1/register/verify')
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ token: 'abc' })
    expect(w.text()).toContain('Email verified')
    expect(w.text()).toContain('must approve')
  })

  it('shows an invalid link with a resend form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url === '/v1/register/verify'
            ? reply(400, { code: 'invalid_verification', message: 'x' })
            : reply(401, { code: 'unauthenticated', message: 'x' }),
        ),
      ),
    )
    const w = await open('/verify-email?token=old')
    expect(w.text()).toContain('Link not valid')
    expect(w.find('input[type=email]').exists()).toBe(true)
  })

  it('treats a missing token as invalid without calling the server', async () => {
    const fn = vi.fn().mockResolvedValue(reply(401, { code: 'unauthenticated', message: 'x' }))
    vi.stubGlobal('fetch', fn)
    const w = await open('/verify-email')
    expect(w.text()).toContain('Link not valid')
    expect(fn.mock.calls.some((c) => c[0] === '/v1/register/verify')).toBe(false)
  })
})

describe('external sign-in', () => {
  it('builds the start url with the page to return to', () => {
    expect(externalSignInUrl('/v1/oidc/authorize', '/acme/game?x=1')).toBe(
      '/v1/oidc/authorize?return_to=%2Facme%2Fgame%3Fx%3D1',
    )
    expect(externalSignInUrl('/v1/oidc/authorize?a=b')).toBe('/v1/oidc/authorize?a=b&return_to=%2F')
  })

  it('explains a provider error and falls back for unknown codes', () => {
    expect(signInErrorMessage('external_account_not_linked')).toContain('No account is linked')
    expect(signInErrorMessage('???')).toBe('Sign-in with the provider failed.')
  })

  const provider = { name: 'Acme SSO', sign_in_url: '/v1/oidc/authorize' }

  it('offers the provider next to the password form', () => {
    const w = mount(PynSignIn, { props: { registration: 'closed', external: provider } })
    expect(w.find('a').text()).toBe('Sign in with Acme SSO')
    expect(w.find('a').attributes('href')).toBe('/v1/oidc/authorize?return_to=%2F')
    expect(w.find('input').exists()).toBe(true)
  })

  it('hides the password form until an administrator asks for it', async () => {
    const w = mount(PynSignIn, {
      props: { registration: 'closed', external: provider, passwordSignIn: false },
    })
    expect(w.find('input').exists()).toBe(false)
    await w.find('button[type=button]').trigger('click')
    expect(w.find('input').exists()).toBe(true)
  })

  it('shows the error the server sent back', () => {
    const w = mount(PynSignIn, {
      props: { registration: 'closed', callbackError: 'external_sign_in_failed' },
    })
    expect(w.find('[role=alert]').text()).toContain('did not complete')
  })
})

describe('name messages', () => {
  const rules = '2 to 39 lowercase letters, digits, "-" or "_", and cannot be a reserved word'

  it('names the rejected value and the rules for a reserved name', () => {
    const e = new ApiError(400, 'reserved_name', '"admin" is reserved and cannot be used as a name')
    expect(describeError(e)).toContain('"admin" is reserved.')
    expect(describeError(e)).toContain(rules)
  })

  it('still words a reserved name when the server text has no name', () => {
    expect(describeError(new ApiError(400, 'reserved_name', 'x'))).toContain(
      'That name is reserved.',
    )
  })

  it('checks the name format before submitting', () => {
    expect(nameProblem('wendy_1')).toBe('')
    for (const bad of ['', 'a', 'Wendy', 'we ndy', 'a'.repeat(40)])
      expect(nameProblem(bad)).toContain(`"${bad}" is not a valid name.`)
    expect(nameProblem('ab')).toBe('')
    expect(nameProblem('a'.repeat(39))).toBe('')
  })
})
