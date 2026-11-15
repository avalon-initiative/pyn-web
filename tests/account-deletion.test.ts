import { PynAccountDelete, PynAccounts } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import * as admin from '../src/api/admin'
import { ApiError } from '../src/api/client'
import { failure } from '../src/api/http'
import { scheduleDeletion } from '../src/api/account-deletion'
import { makeRouter } from '../src/router'
import { sessionKey } from '../src/state/context.state'
import { retentionNote } from '../src/state/admin-settings.state'
import AdminAccountsView from '../src/views/AdminAccountsView.vue'
import DeleteAccountView from '../src/views/DeleteAccountView.vue'
import { accounts } from './fixtures/admin-data'

vi.mock('../src/api/admin')
vi.mock('../src/api/account-deletion')

const scheduled = vi.fn()
const provide = {
  [sessionKey as symbol]: { user: ref('root'), admin: ref(true), expire: vi.fn(), scheduled },
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(admin.fetchMe).mockResolvedValue({ id: 'a', user: 'root', has_password: true })
})

describe('DeleteAccountView', () => {
  it('routes under account settings', () => {
    expect(makeRouter(createMemoryHistory()).resolve('/_/settings/delete').name).toBe(
      'delete-account',
    )
  })

  it('sends the password and reports the scheduled deletion', async () => {
    const status = {
      pending: true,
      purge_at: '2026-12-15T00:00:00Z',
      scheduled_at: null,
      user: 'root',
    }
    vi.mocked(scheduleDeletion).mockResolvedValue(status)
    const w = mount(DeleteAccountView, { global: { provide } })
    await flushPromises()
    w.findComponent(PynAccountDelete).vm.$emit('remove', 'pw')
    await flushPromises()
    expect(scheduleDeletion).toHaveBeenCalledWith('pw')
    expect(scheduled).toHaveBeenCalledWith(status)
  })

  it('treats an account with no password as external', async () => {
    vi.mocked(admin.fetchMe).mockResolvedValue({ id: 'a', user: 'root', has_password: false })
    const w = mount(DeleteAccountView, { global: { provide } })
    await flushPromises()
    expect(w.findComponent(PynAccountDelete).props('external')).toBe(true)
  })

  it('passes the blocking repositories and organizations on', async () => {
    vi.mocked(scheduleDeletion).mockRejectedValue(
      new ApiError(409, 'account_owns_resources', 'owns things', undefined, {
        repos: ['root/game'],
        orgs: ['studio'],
      }),
    )
    const w = mount(DeleteAccountView, { global: { provide } })
    await flushPromises()
    w.findComponent(PynAccountDelete).vm.$emit('remove', 'pw')
    await flushPromises()
    expect(w.findComponent(PynAccountDelete).props('blockers')).toEqual({
      repos: ['root/game'],
      orgs: ['studio'],
    })
    expect(scheduled).not.toHaveBeenCalled()
  })
})

describe('failure', () => {
  it('maps the server blockers to repos and orgs', async () => {
    const res = new Response(
      JSON.stringify({
        code: 'account_owns_resources',
        message: 'm',
        blockers: { repositories: ['a/b'], organizations: ['o'] },
      }),
      { status: 409 },
    )
    expect((await failure(res)).blockers).toEqual({ repos: ['a/b'], orgs: ['o'] })
  })
})

describe('AdminAccountsView deletion', () => {
  const settings = { account_deletion: { window_days: 30, disabled_retention_days: 0 } }

  it('deletes with the reason and the immediate choice, then reloads', async () => {
    vi.mocked(admin.listAccounts).mockResolvedValue(accounts)
    vi.mocked(admin.fetchAdminSettings).mockResolvedValue(settings)
    vi.mocked(admin.deleteAccount).mockResolvedValue({
      deleted: false,
      purge_at: null,
      user: 'dave',
    })
    const w = mount(AdminAccountsView, { global: { provide } })
    await flushPromises()
    w.findComponent(PynAccounts).vm.$emit('delete', {
      user: 'dave',
      reason: 'gone',
      immediately: true,
    })
    await flushPromises()
    expect(admin.deleteAccount).toHaveBeenCalledWith({
      user: 'dave',
      reason: 'gone',
      immediately: true,
    })
    expect(admin.listAccounts).toHaveBeenCalledTimes(2)
    expect(w.text()).toContain('Automatic deletion of disabled accounts is off.')
  })

  it('describes automatic deletion', () => {
    expect(
      retentionNote({ account_deletion: { window_days: 30, disabled_retention_days: 90 } }),
    ).toContain('deleted automatically after 90 days')
  })
})
