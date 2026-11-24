import {
  PynAccounts,
  PynOrgSettings,
  PynTwoFactorRequirement,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { describeError, ApiError } from '../src/api/client'
import { makeRouter } from '../src/router'
import { orgKey, sessionKey } from '../src/state/context.state'
import { orgs } from './fixtures/org-data'
import AdminAccountsView from '../src/views/AdminAccountsView.vue'
import AdminTwoFactorView from '../src/views/AdminTwoFactorView.vue'
import OrgSettingsView from '../src/views/OrgSettingsView.vue'

const reply = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), { status })

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

const body = (fn: ReturnType<typeof serve>, line: string) =>
  fn.mock.calls
    .filter((c) => `${c[1]?.method ?? 'GET'} ${c[0]}` === line)
    .map((c) => (c[1]?.body ? JSON.parse(String(c[1].body)) : null))

const session = {
  global: {
    provide: { [sessionKey as symbol]: { user: ref('root'), admin: ref(true), expire: () => {} } },
  },
}

afterEach(() => vi.unstubAllGlobals())

describe('server two-factor requirement', () => {
  it('has an admin route', () => {
    expect(makeRouter(createMemoryHistory()).resolve('/_/admin/two-factor').name).toBe(
      'admin-two-factor',
    )
  })

  it('shows the setting and saves a change', async () => {
    const fn = serve({
      'GET /v1/admin/two-factor': () => reply(200, { required: false }),
      'PUT /v1/admin/two-factor': () =>
        reply(200, { required: true, grace_days: 14, since: '2026-11-19T00:00:00Z' }),
    })
    const w = mount(AdminTwoFactorView)
    await flushPromises()
    const form = w.findComponent(PynTwoFactorRequirement)
    expect(form.props('setting')).toEqual({ required: false })
    form.vm.$emit('change', { required: true, grace_days: 14 })
    await flushPromises()
    expect(body(fn, 'PUT /v1/admin/two-factor')[0]).toEqual({ required: true, grace_days: 14 })
    expect(w.findComponent(PynTwoFactorRequirement).props('setting').required).toBe(true)
  })

  it('reports a refused change', async () => {
    serve({
      'GET /v1/admin/two-factor': () => reply(200, { required: false }),
      'PUT /v1/admin/two-factor': () =>
        reply(400, { code: 'invalid_request', message: 'bad days' }),
    })
    const w = mount(AdminTwoFactorView)
    await flushPromises()
    w.findComponent(PynTwoFactorRequirement).vm.$emit('change', { required: true, grace_days: 99 })
    await flushPromises()
    expect(w.findComponent(PynTwoFactorRequirement).props('error')).toBe('bad days')
  })
})

describe('resetting an account', () => {
  const routes = {
    'GET /v1/admin/users': () => reply(200, []),
    'GET /v1/admin/settings': () =>
      reply(200, { administrators: { active: 2, single: false }, deletion: {} }),
    'POST /v1/admin/users/bob/two-factor/reset': () => reply(204, null),
  }

  it('resets only after confirming', async () => {
    const fn = serve(routes)
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true)
    vi.stubGlobal('confirm', confirm)
    const w = mount(AdminAccountsView, session)
    await flushPromises()
    w.findComponent(PynAccounts).vm.$emit('reset', 'bob')
    await flushPromises()
    expect(body(fn, 'POST /v1/admin/users/bob/two-factor/reset')).toEqual([])
    w.findComponent(PynAccounts).vm.$emit('reset', 'bob')
    await flushPromises()
    expect(confirm.mock.calls[0]![0]).toContain('bob')
    expect(body(fn, 'POST /v1/admin/users/bob/two-factor/reset')).toHaveLength(1)
  })
})

describe('organization settings', () => {
  const provide = {
    [sessionKey as symbol]: { user: ref('alice'), admin: ref(false), expire: () => {} },
    [orgKey as symbol]: {
      name: computed(() => 'studio'),
      org: ref(orgs[0]),
      frozen: ref(false),
      reload: async () => {},
    },
  }

  it('loads the read-only default and the requirement and saves each', async () => {
    const fn = serve({
      'GET /v1/orgs/studio/repo-policy': () => reply(200, { member_creation: 'none', rules: [] }),
      'GET /v1/orgs/studio/teams': () => reply(200, []),
      'GET /v1/orgs/studio/members': () => reply(200, []),
      'GET /v1/orgs/studio/settings': () => reply(200, { exclusive_read_only: null }),
      'PUT /v1/orgs/studio/settings': (b) => reply(200, JSON.parse(b)),
      'GET /v1/orgs/studio/two-factor': () => reply(200, { required: false }),
      'PUT /v1/orgs/studio/two-factor': () =>
        reply(200, { required: true, grace_days: 3, since: '2026-11-19T00:00:00Z' }),
    })
    const w = mount(OrgSettingsView, { global: { provide } })
    await flushPromises()
    expect(w.findComponent(PynTwoFactorRequirement).props('title')).toBe(
      'Two-factor authentication',
    )
    w.findComponent(PynOrgSettings).vm.$emit('save', { exclusive_read_only: true })
    w.findComponent(PynTwoFactorRequirement).vm.$emit('change', { required: true, grace_days: 3 })
    await flushPromises()
    expect(body(fn, 'PUT /v1/orgs/studio/settings')[0]).toEqual({ exclusive_read_only: true })
    expect(body(fn, 'PUT /v1/orgs/studio/two-factor')[0]).toEqual({
      required: true,
      grace_days: 3,
    })
    expect(w.findComponent(PynOrgSettings).props('settings')).toEqual({ exclusive_read_only: true })
  })
})

describe('friendly text for two-factor errors', () => {
  it.each([
    ['second_factor_invalid', 'not right'],
    ['passkey_invalid', 'passkey'],
    ['fresh_check_required', 'second factor'],
    ['two_factor_enrolment_required', 'Set up a second factor'],
    ['passkeys_unavailable', 'passkeys'],
  ])('words %s', (code, text) => {
    expect(describeError(new ApiError(403, code, 'raw'))).toContain(text)
  })
})
