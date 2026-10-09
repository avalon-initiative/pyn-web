import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import PynAccounts from '../src/components/PynAccounts.vue'
import PynAudit from '../src/components/PynAudit.vue'
import PynPageNotFound from '../src/components/PynPageNotFound.vue'
import PynTopBar from '../src/components/PynTopBar.vue'
import { accountActions, applyUpdate } from '../src/state/admin.state'
import { sessionKey } from '../src/state/context.state'
import { activeNav, navItems } from '../src/state/shell.state'
import { accounts } from '../src/stories/admin-data'
import AdminAccountsView from '../src/views/AdminAccountsView.vue'
import { makeRouter } from '../src/router'
import { createMemoryHistory } from 'vue-router'

const [root, bob, carol, dave] = accounts
const buttons = (w: ReturnType<typeof mount>, text: string) =>
  w.findAll('button').filter((b) => b.text().startsWith(text))

describe('admin state', () => {
  it('offers what the server accepts and never disabling oneself', () => {
    expect(accountActions(root, 'root')).toEqual([])
    expect(accountActions(root, 'other')).toEqual(['disable'])
    expect(accountActions(bob, 'root')).toEqual(['approve', 'disable'])
    expect(accountActions(carol, 'root')).toEqual(['disable'])
    expect(accountActions(dave, 'root')).toEqual(['enable'])
  })

  it('replaces an updated account and drops it when the filter no longer matches', () => {
    const active = { ...bob, status: 'active' as const }
    expect(applyUpdate(accounts, active, '')[1]).toEqual(active)
    expect(applyUpdate(accounts.slice(1, 2), active, 'pending_approval')).toEqual([])
  })

  it('shows the Accounts link only to administrators', () => {
    expect(navItems(false).some((i) => i.id === 'accounts')).toBe(false)
    expect(navItems(true).some((i) => i.href === '/_/admin/accounts')).toBe(true)
    expect(activeNav('/_/admin/accounts')).toBe('accounts')
  })

  it('routes the page under /_/', () => {
    const router = makeRouter(createMemoryHistory())
    expect(router.resolve('/_/admin/accounts').name).toBe('admin-accounts')
  })
})

describe('PynTopBar', () => {
  const open = async (admin?: boolean) => {
    const w = mount(PynTopBar, { props: { user: 'root', repos: [], theme: 'system', admin } })
    await w.find('[aria-label="Account menu"]').trigger('click')
    return w
  }

  it('links Accounts in the account menu for administrators only', async () => {
    expect((await open(true)).find('[href="/_/admin/accounts"]').exists()).toBe(true)
    expect((await open()).find('[href="/_/admin/accounts"]').exists()).toBe(false)
  })
})

describe('PynAccounts', () => {
  const props = { accounts, status: '' as const, self: 'root' }

  it('lists status, email and the disable reason with shared date format', () => {
    const w = mount(PynAccounts, { props })
    expect(w.text()).toContain('Needs approval')
    expect(w.text()).toContain('bob@example.com')
    expect(w.text()).toContain('Disabled Oct 05 2026 14:00: Left the studio')
    expect(w.text()).toContain('Left the studio')
    expect(w.text()).toContain('(unverified)')
  })

  it('has no disable button for the signed-in administrator', () => {
    const w = mount(PynAccounts, { props: { ...props, accounts: [root] } })
    expect(w.findAll('li button')).toHaveLength(0)
  })

  it('emits the status filter, approve and enable', async () => {
    const w = mount(PynAccounts, { props })
    await w.find('select').setValue('disabled')
    expect(w.emitted('status')?.[0]).toEqual(['disabled'])
    await buttons(w, 'Approve')[0].trigger('click')
    expect(w.emitted('approve')?.[0]).toEqual(['bob'])
    await buttons(w, 'Enable')[0].trigger('click')
    expect(w.emitted('enable')?.[0]).toEqual(['dave'])
  })

  it('confirms with an optional reason before disabling, and can cancel', async () => {
    const w = mount(PynAccounts, { props })
    await buttons(w, 'Disable')[0].trigger('click')
    expect(w.emitted('disable')).toBeUndefined()
    await buttons(w, 'Cancel')[0].trigger('click')
    expect(w.find('input').exists()).toBe(false)
    await buttons(w, 'Disable')[0].trigger('click')
    await w.find('input').setValue('spam')
    await w.find('form').trigger('submit')
    expect(w.emitted('disable')?.[0]).toEqual([{ user: 'bob', reason: 'spam' }])
    expect(w.find('input').exists()).toBe(false)
  })

  it('says when nothing matches and shows errors', () => {
    const w = mount(PynAccounts, { props: { ...props, accounts: [], error: 'boom' } })
    expect(w.text()).toContain('No accounts match.')
    expect(w.find('[role=alert]').text()).toBe('boom')
  })
})

describe('PynAudit plain', () => {
  it('hides the filter form', () => {
    const entries = [{ id: 1, at: '2026-10-07T09:00:00Z', actor: 'root', action: 'x', detail: 'y' }]
    const w = mount(PynAudit, { props: { entries, plain: true } })
    expect(w.find('form').exists()).toBe(false)
    expect(w.text()).toContain('Oct 07 2026')
  })
})

describe('PynPageNotFound', () => {
  it('is an alert', () => {
    expect(mount(PynPageNotFound).find('[role=alert]').text()).toContain('Page not found')
  })
})

describe('AdminAccountsView', () => {
  afterEach(() => vi.unstubAllGlobals())

  const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body)))
  const view = (admin: boolean) =>
    mount(AdminAccountsView, {
      global: { provide: { [sessionKey as symbol]: { user: ref('root'), admin: ref(admin) } } },
    })

  it('shows not found and calls nothing for a non-administrator', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const w = view(false)
    await flushPromises()
    expect(w.text()).toContain('Page not found')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loads accounts and the audit log, then disables with a reason', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? 'GET'} ${url} ${init?.body ?? ''}`.trim())
        if (url.startsWith('/v1/admin/audit')) return json({ entries: [], next_before: null })
        if (url.endsWith('/disable')) return json({ ...bob, status: 'disabled' })
        return json(accounts)
      }),
    )
    const w = view(true)
    await flushPromises()
    expect(w.text()).toContain('Server audit log')
    expect(w.text()).toContain('bob')
    await buttons(w, 'Disable')[0].trigger('click')
    await w.find('input').setValue('spam')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(calls).toContain('POST /v1/admin/users/bob/disable {"reason":"spam"}')
    expect(calls.filter((c) => c.includes('/v1/admin/audit'))).toHaveLength(2)
  })
})
