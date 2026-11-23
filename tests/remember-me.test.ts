import { PynSignIn } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { rememberedUser } from '../src/state/remember.state'

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

async function openSignedOut(fn: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fn)
  const router = makeRouter(createMemoryHistory())
  await router.push('/')
  await router.isReady()
  const { default: App } = await import('../src/App.vue')
  const w = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  return w
}

const server = (signIn: (init: RequestInit) => Response) =>
  vi.fn((url: string, init?: RequestInit) =>
    Promise.resolve(
      url === '/v1/session' && init?.method === 'POST'
        ? signIn(init)
        : url === '/v1/setup'
          ? reply(200, { initialised: true })
          : reply(401, { code: 'unauthenticated', message: 'x' }),
    ),
  )

const ok = () => reply(200, { user: 'wendy', csrf_token: 't', expires_at: '2030-01-01T00:00:00Z' })

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('remember me', () => {
  it('offers the remember option and keeps stay-signed-in off', async () => {
    const w = await openSignedOut(server(ok))
    const form = w.findComponent(PynSignIn)
    expect(form.props('rememberOption')).toBe(true)
    expect(form.props('staySignedInOption')).toBe(false)
  })

  it('remembers the name when checked and sends only the credentials', async () => {
    const fn = server(ok)
    const w = await openSignedOut(fn)
    const form = w.findComponent(PynSignIn)
    form.vm.$emit('update:remember', true)
    form.vm.$emit('signIn', { username: 'wendy', password: 'pw', remember: true })
    await flushPromises()
    expect(rememberedUser()).toBe('wendy')
    const post = fn.mock.calls.find((c) => c[1]?.method === 'POST' && c[0] === '/v1/session')
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      username: 'wendy',
      password: 'pw',
      code: null,
    })
  })

  it('forgets the name when unchecked', async () => {
    localStorage.setItem('pyn.remembered-user', 'wendy')
    const w = await openSignedOut(server(ok))
    const form = w.findComponent(PynSignIn)
    form.vm.$emit('update:remember', false)
    form.vm.$emit('signIn', { username: 'wendy', password: 'pw' })
    await flushPromises()
    expect(rememberedUser()).toBe('')
  })

  it('starts checked when a name is already remembered', async () => {
    localStorage.setItem('pyn.remembered-user', 'wendy')
    const w = await openSignedOut(server(ok))
    expect(w.findComponent(PynSignIn).props('remember')).toBe(true)
  })

  it('previews the stored form of a name being registered', async () => {
    const w = await openSignedOut(server(ok))
    const form = w.findComponent(PynSignIn)
    form.vm.$emit('nameInput', 'Wendy B')
    await flushPromises()
    expect(form.props('nameCanonical')).toBe('wendy-b')
  })
})
