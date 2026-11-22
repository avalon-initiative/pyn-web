import { PynAccounts, PynSetup, PynSignIn, PynViewNotice } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import * as admin from '../src/api/admin'
import { ApiError } from '../src/api/client'
import { makeRouter } from '../src/router'
import { sessionKey } from '../src/state/context.state'
import AdminAccountsView from '../src/views/AdminAccountsView.vue'
import { accounts } from './fixtures/admin-data'

vi.mock('../src/api/admin')

const provide = {
  [sessionKey as symbol]: { user: ref('root'), admin: ref(true), expire: vi.fn() },
}
const settings = (active: number) => ({
  account_deletion: { window_days: 30, disabled_retention_days: 0 },
  storage: { kind: 'memory' as const, status: 'ok' as const },
  certificate: { state: 'unchecked' as const, names: [] },
  administrators: { active, single: active === 1 },
})

const open = async (active: number) => {
  vi.mocked(admin.listAccounts).mockResolvedValue(accounts)
  vi.mocked(admin.fetchAdminSettings).mockResolvedValue(settings(active))
  const w = mount(AdminAccountsView, { global: { provide } })
  await flushPromises()
  return w
}

beforeEach(() => vi.resetAllMocks())

describe('single administrator warning', () => {
  it('warns while one administrator exists and blocks revoking', async () => {
    const w = await open(1)
    expect(w.findComponent(PynViewNotice).text()).toContain('Only one administrator')
    expect(w.findComponent(PynAccounts).props('canRevokeAdmin')).toBe(false)
  })

  it('stays quiet with several administrators', async () => {
    const w = await open(2)
    expect(w.findComponent(PynViewNotice).exists()).toBe(false)
    expect(w.findComponent(PynAccounts).props('canRevokeAdmin')).toBe(true)
  })

  it('grants, then reloads accounts and settings so the warning clears', async () => {
    const w = await open(1)
    vi.mocked(admin.grantAdmin).mockResolvedValue(accounts[1])
    vi.mocked(admin.fetchAdminSettings).mockResolvedValue(settings(2))
    w.findComponent(PynAccounts).vm.$emit('grantAdmin', 'bob')
    await flushPromises()
    expect(admin.grantAdmin).toHaveBeenCalledWith('bob')
    expect(admin.listAccounts).toHaveBeenCalledTimes(2)
    expect(w.findComponent(PynViewNotice).exists()).toBe(false)
  })

  it('revokes, then reloads and brings the warning back', async () => {
    const w = await open(2)
    vi.mocked(admin.revokeAdmin).mockResolvedValue(accounts[0])
    vi.mocked(admin.fetchAdminSettings).mockResolvedValue(settings(1))
    w.findComponent(PynAccounts).vm.$emit('revokeAdmin', 'dave')
    await flushPromises()
    expect(admin.revokeAdmin).toHaveBeenCalledWith('dave')
    expect(w.findComponent(PynViewNotice).exists()).toBe(true)
  })

  it('shows the refusal to revoke the last administrator', async () => {
    const w = await open(2)
    vi.mocked(admin.revokeAdmin).mockRejectedValue(
      new ApiError(409, 'last_server_admin', 'no other active administrator would remain'),
    )
    w.findComponent(PynAccounts).vm.$emit('revokeAdmin', 'root')
    await flushPromises()
    expect(w.findComponent(PynAccounts).props('error')).toContain('administrator')
  })
})

describe('setup suggestion', () => {
  const reply = (status: number, body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }))
  afterEach(() => vi.unstubAllGlobals())

  it('passes the suggestion and routes to the accounts page on manageAdmins', async () => {
    let signedIn = false
    vi.mocked(admin.fetchMe).mockResolvedValue({ id: 'a', user: 'root', has_password: true })
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/v1/setup')
          return reply(200, { initialised: false, registration: 'closed', public_url: 'http://x' })
        if (url === '/v1/session' && !signedIn)
          return reply(401, { code: 'unauthenticated', message: 'x' })
        if (url === '/v1/session') return reply(200, { user: 'root', csrf_token: 't' })
        return reply(404, { code: 'not_found', message: 'x' })
      }),
    )
    const router = makeRouter(createMemoryHistory())
    await router.push('/')
    const { default: App } = await import('../src/App.vue')
    const w = mount(App, { global: { plugins: [router] } })
    await flushPromises()
    const setup = w.findComponent(PynSetup)
    expect(setup.props('suggestSecondAdmin')).toBe(true)
    const form = {
      token: 't',
      username: 'root',
      password: 'pw',
      email: '',
      server_name: '',
      public_url: '',
      registration: 'closed',
    }
    const posts: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === 'POST') posts.push(url)
        if (url === '/v1/setup' && init?.method === 'POST') return reply(200, {})
        if (url === '/v1/session' && init?.method === 'POST') {
          signedIn = true
          return reply(200, { user: 'root', csrf_token: 't' })
        }
        return reply(404, { code: 'not_found', message: 'x' })
      }),
    )
    setup.vm.$emit('finish', form)
    await flushPromises()
    expect(posts).toEqual(['/v1/setup'])
    expect(setup.props('done')).toBe(true)
    expect(w.findComponent(PynSignIn).exists()).toBe(false)
    w.findComponent(PynSetup).vm.$emit('manageAdmins')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('admin-accounts')
    expect(w.findComponent(PynSetup).exists()).toBe(false)
    expect(posts).toEqual(['/v1/setup'])
    const page = w.findComponent(PynSignIn)
    expect(page.props('initialUsername')).toBe(form.username)
    expect(JSON.stringify(page.props())).not.toContain(form.password)
    expect((page.find('input[type=password]').element as HTMLInputElement).value).toBe('')
    expect((page.find('input[autocomplete=username]').element as HTMLInputElement)?.value).toBe(
      'root',
    )
    page.vm.$emit('signIn', { username: 'root', password: 'chosen' })
    await flushPromises()
    expect(posts).toEqual(['/v1/setup', '/v1/session'])
    expect(router.currentRoute.value.name).toBe('admin-accounts')
    expect(w.findComponent(PynSignIn).exists()).toBe(false)
  })

  it('shows the sign-in page after the plain sign-in step', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/v1/setup')
          return reply(200, { initialised: false, registration: 'closed', public_url: 'http://x' })
        return reply(401, { code: 'unauthenticated', message: 'x' })
      }),
    )
    const router = makeRouter(createMemoryHistory())
    await router.push('/')
    const { default: App } = await import('../src/App.vue')
    const w = mount(App, { global: { plugins: [router] } })
    await flushPromises()
    w.findComponent(PynSetup).vm.$emit('signIn')
    await flushPromises()
    expect(w.findComponent(PynSignIn).exists()).toBe(true)
    expect(router.currentRoute.value.path).toBe('/')
  })
})
