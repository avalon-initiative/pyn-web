import {
  PynAccounts,
  PynAdminLayout,
  PynAudit,
  PynPageNotFound,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { sessionKey } from '../src/state/context.state'
import AdminAuditView from '../src/views/AdminAuditView.vue'
import AdminView from '../src/views/AdminView.vue'
import { accounts } from './fixtures/admin-data'

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))
const entry = (id: number) => ({
  id,
  at: '2026-10-07T09:00:00Z',
  actor: 'root',
  hash: 'a'.repeat(64),
  action: 'account.approve',
  detail: `entry ${id}`,
})

const session = (admin: boolean) => ({
  [sessionKey as symbol]: { user: ref('root'), admin: ref(admin), expire: vi.fn() },
})

const open = async (path: string, admin = true) => {
  const router = makeRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const w = mount(AdminView, {
    global: { plugins: [router], provide: session(admin), stubs: { RouterView: false } },
  })
  await flushPromises()
  return { w, router }
}

describe('admin area', () => {
  let urls: string[] = []
  const stub = (
    audit: () => Promise<Response> = () => json({ entries: [], next_before: null }),
  ) => {
    urls = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        urls.push(url)
        if (url.startsWith('/v1/admin/audit')) return audit()
        if (url.startsWith('/v1/admin/webhooks')) return json([])
        return json(accounts)
      }),
    )
  }
  afterEach(() => vi.unstubAllGlobals())

  it('redirects /_/admin to the accounts page', async () => {
    stub()
    const { router } = await open('/_/admin')
    expect(router.currentRoute.value.path).toBe('/_/admin/accounts')
  })

  it.each([
    ['/_/admin/accounts', 'accounts'],
    ['/_/admin/audit', 'audit'],
    ['/_/admin/webhooks', 'webhooks'],
  ])('wraps %s in the admin layout with current %s', async (path, current) => {
    stub()
    const { w } = await open(path)
    const layout = w.findComponent(PynAdminLayout)
    expect(layout.props('current')).toBe(current)
    expect(layout.props('items').map((i: { id: string }) => i.id)).toEqual([
      'accounts',
      'audit',
      'webhooks',
    ])
  })

  it('keeps accounts and the audit log on separate pages', async () => {
    stub()
    const accountsPage = (await open('/_/admin/accounts')).w
    expect(accountsPage.findComponent(PynAccounts).exists()).toBe(true)
    expect(accountsPage.findComponent(PynAudit).exists()).toBe(false)
    expect(urls.some((u) => u.startsWith('/v1/admin/audit'))).toBe(false)
    const auditPage = (await open('/_/admin/audit')).w
    expect(auditPage.findComponent(PynAudit).exists()).toBe(true)
    expect(auditPage.findComponent(PynAccounts).exists()).toBe(false)
  })

  it.each(['/_/admin/accounts', '/_/admin/audit', '/_/admin/webhooks'])(
    'refuses a non-administrator on %s and sends nothing',
    async (path) => {
      stub()
      const { w } = await open(path, false)
      expect(w.findComponent(PynPageNotFound).exists()).toBe(true)
      expect(w.findComponent(PynAdminLayout).exists()).toBe(false)
      expect(urls).toEqual([])
    },
  )
})

describe('AdminAuditView', () => {
  afterEach(() => vi.unstubAllGlobals())
  const view = () => mount(AdminAuditView)

  it('loads the log and pages with before=next_before', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        urls.push(url)
        return url.includes('before=')
          ? json({ entries: [entry(1)], next_before: null })
          : json({ entries: [entry(3), entry(2)], next_before: 2 })
      }),
    )
    const w = view()
    await flushPromises()
    const audit = w.findComponent(PynAudit)
    expect(audit.props('entries')).toHaveLength(2)
    expect(audit.props('hasMore')).toBe(true)
    audit.vm.$emit('more')
    await flushPromises()
    expect(urls.at(-1)).toBe('/v1/admin/audit?before=2')
    expect(audit.props('entries').map((e: { id: number }) => e.id)).toEqual([3, 2, 1])
    expect(audit.props('hasMore')).toBe(false)
  })

  it('shows the server error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json({ code: 'server_admin_required', message: 'administrators only' }, 403)),
    )
    const w = view()
    await flushPromises()
    expect(w.findComponent(PynAudit).props('error')).toContain('administrator')
  })
})
