import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { register, resendVerification, signIn, verifyEmail } from '../src/api/auth'
import { ApiError, describeError } from '../src/api/client'
import { makeRouter } from '../src/router'
import { blockedStatus } from '../src/state/account.state'
import { formatWait } from '../src/state/wait.state'

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) => ({
  ok: status < 400,
  status,
  headers: new Headers(headers),
  json: async () => body,
})

afterEach(() => vi.unstubAllGlobals())

describe('wait text', () => {
  it('rounds up to the largest sensible unit', () => {
    expect(formatWait(1)).toBe('1 second')
    expect(formatWait(45)).toBe('45 seconds')
    expect(formatWait(61)).toBe('2 minutes')
    expect(formatWait(900)).toBe('15 minutes')
    expect(formatWait(3600)).toBe('1 hour')
    expect(formatWait(undefined)).toBe('a moment')
  })
})

describe('account api', () => {
  it('registers with the email and reports the status', async () => {
    const fn = vi
      .fn()
      .mockResolvedValue(reply(201, { user: 'wendy', status: 'pending_verification' }))
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
