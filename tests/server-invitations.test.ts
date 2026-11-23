import {
  PynAccounts,
  PynAddAccount,
  PynEmailStatus,
  PynServerInvitations,
  PynViewNotice,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import * as admin from '../src/api/admin'
import { fetchRegistration } from '../src/api/auth'
import { ApiError, describeError } from '../src/api/client'
import { sessionKey } from '../src/state/context.state'
import { invitationTargets } from '../src/state/server-invitations.state'
import { sessionOrgs, sessionRepos } from '../src/state/session-data.state'
import AdminAccessView from '../src/views/AdminAccessView.vue'
import AdminAccountsView from '../src/views/AdminAccountsView.vue'
import AdminInvitationsView from '../src/views/AdminInvitationsView.vue'
import { accounts } from './fixtures/admin-data'

vi.mock('../src/api/admin')
vi.mock('../src/api/auth')

const provide = {
  [sessionKey as symbol]: { user: ref('root'), admin: ref(true), expire: vi.fn() },
}
const invite = (id: string, over = {}) => ({
  id,
  email: null,
  grant: null,
  created_by: 'root',
  created_at: '2026-11-01T00:00:00Z',
  expires_at: '2026-11-08T00:00:00Z',
  status: 'pending' as const,
  ...over,
})
const repo = (owner: string, name: string) => ({ owner, name }) as never
const org = (name: string) => ({ id: name, name, created_at: '2026-10-01T00:00:00Z' }) as never

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(fetchRegistration).mockResolvedValue({ registration: 'invite' })
  sessionRepos.value = [repo('alice', 'site'), repo('acme', 'game')]
  sessionOrgs.value = [org('acme')]
})

describe('server invitation targets', () => {
  it('offers organizations and personal repositories, not an organization repository', () => {
    expect(invitationTargets(sessionRepos.value, sessionOrgs.value)).toEqual([
      { kind: 'organization', name: 'acme' },
      { kind: 'repository', name: 'alice/site' },
    ])
  })
})

describe('AdminInvitationsView', () => {
  const open = async (list = [invite('i1'), invite('i2', { status: 'used', used_by: 'bob' })]) => {
    vi.mocked(admin.listServerInvitations).mockResolvedValue(list)
    const w = mount(AdminInvitationsView, { global: { provide } })
    await flushPromises()
    return w
  }

  it('lists invitations and passes targets, roles and the server address', async () => {
    const w = await open()
    const c = w.findComponent(PynServerInvitations)
    expect(c.props('invitations')).toHaveLength(2)
    expect(c.props('targets')).toHaveLength(2)
    expect(c.props('roles')?.map((r: { value: string }) => r.value)).toEqual([
      'reader',
      'writer',
      'maintainer',
      'admin',
      'member',
      'owner',
    ])
    expect(c.props('serverUrl')).toBe(window.location.origin)
  })

  it('creates with the request body, shows the code once and reloads the list', async () => {
    const w = await open([])
    vi.mocked(admin.createServerInvitation).mockResolvedValue({
      code: 'pynv_abc',
      emailed: true,
      invitation: invite('i3'),
    })
    vi.mocked(admin.listServerInvitations).mockResolvedValue([invite('i3')])
    const body = {
      email: 'new@example.com',
      expires_in_days: 3,
      grant: { organization: 'acme', role: 'member' },
    }
    w.findComponent(PynServerInvitations).vm.$emit('create', body)
    await flushPromises()
    expect(admin.createServerInvitation).toHaveBeenCalledWith(body)
    const c = w.findComponent(PynServerInvitations)
    expect(c.props('created')).toBe('pynv_abc')
    expect(c.props('emailed')).toBe(true)
    expect(c.props('invitations')).toHaveLength(1)
    c.vm.$emit('dismiss')
    await flushPromises()
    expect(w.findComponent(PynServerInvitations).props('created')).toBe('')
  })

  it('shows a create error and no code', async () => {
    const w = await open([])
    vi.mocked(admin.createServerInvitation).mockRejectedValue(
      new ApiError(404, 'repo_not_found', 'x'),
    )
    w.findComponent(PynServerInvitations).vm.$emit('create', { expires_in_days: 7 })
    await flushPromises()
    const c = w.findComponent(PynServerInvitations)
    expect(c.props('error')).toContain('repository does not exist')
    expect(c.props('created')).toBeFalsy()
  })

  it('revokes and reloads', async () => {
    const w = await open()
    vi.mocked(admin.revokeServerInvitation).mockResolvedValue(undefined)
    vi.mocked(admin.listServerInvitations).mockResolvedValue([invite('i2')])
    w.findComponent(PynServerInvitations).vm.$emit('revoke', 'i1')
    await flushPromises()
    expect(admin.revokeServerInvitation).toHaveBeenCalledWith('i1')
    expect(w.findComponent(PynServerInvitations).props('invitations')).toHaveLength(1)
  })

  it('words a vanished invitation and refreshes the list', async () => {
    const w = await open()
    vi.mocked(admin.revokeServerInvitation).mockRejectedValue(
      new ApiError(404, 'server_invitation_not_found', 'x'),
    )
    vi.mocked(admin.listServerInvitations).mockResolvedValue([])
    w.findComponent(PynServerInvitations).vm.$emit('revoke', 'i1')
    await flushPromises()
    const c = w.findComponent(PynServerInvitations)
    expect(c.props('error')).toContain('no longer exists')
    expect(c.props('invitations')).toHaveLength(0)
  })

  it('words the new error codes', () => {
    for (const code of ['invalid_invite', 'user_exists', 'email_already_confirmed'])
      expect(describeError(new ApiError(409, code, 'raw server text'))).not.toBe('raw server text')
  })
})

describe('AdminAccountsView: add account', () => {
  const open = async () => {
    vi.mocked(admin.listAccounts).mockResolvedValue(accounts)
    vi.mocked(admin.fetchAdminSettings).mockRejectedValue(new Error('x'))
    const w = mount(AdminAccountsView, { global: { provide } })
    await flushPromises()
    return w
  }

  it('adds, says the person must change the password, and reloads', async () => {
    const w = await open()
    vi.mocked(admin.addAccount).mockResolvedValue(accounts[0])
    w.findComponent(PynAddAccount).vm.$emit('add', { username: 'newbie', password: 'one-time-pw1' })
    await flushPromises()
    expect(admin.addAccount).toHaveBeenCalledWith('newbie', 'one-time-pw1')
    expect(vi.mocked(admin.listAccounts)).toHaveBeenCalledTimes(2)
    expect(w.findComponent(PynViewNotice).text()).toContain('Added newbie')
    expect(w.findComponent(PynViewNotice).text()).toContain('choose their own password')
  })

  it('shows user_exists on the form', async () => {
    const w = await open()
    vi.mocked(admin.addAccount).mockRejectedValue(new ApiError(409, 'user_exists', 'x'))
    w.findComponent(PynAddAccount).vm.$emit('add', { username: 'bob', password: 'one-time-pw1' })
    await flushPromises()
    expect(w.findComponent(PynAddAccount).props('error')).toContain('already taken')
    expect(w.findComponent(PynViewNotice).exists()).toBe(false)
  })
})

describe('AdminAccountsView: pending verification and resend', () => {
  const open = async () => {
    vi.mocked(admin.listAccounts).mockResolvedValue(accounts)
    vi.mocked(admin.fetchAdminSettings).mockRejectedValue(new Error('x'))
    const w = mount(AdminAccountsView, { global: { provide } })
    await flushPromises()
    return w
  }
  const resend = async (w: Awaited<ReturnType<typeof open>>) => {
    w.findComponent(PynAccounts).vm.$emit('resendConfirmation', 'carol')
    await flushPromises()
  }

  it('marks only accounts whose status is pending_verification', async () => {
    const w = await open()
    const flags = Object.fromEntries(
      w
        .findComponent(PynAccounts)
        .props('accounts')
        .map((a: { user: string; pending_verification?: boolean }) => [
          a.user,
          a.pending_verification,
        ]),
    )
    expect(flags.carol).toBe(true)
    expect(flags.root).toBe(false)
    expect(flags.bob).toBe(false)
  })

  it('resends and says it was sent', async () => {
    const w = await open()
    vi.mocked(admin.resendConfirmation).mockResolvedValue(undefined)
    await resend(w)
    expect(admin.resendConfirmation).toHaveBeenCalledWith('carol')
    expect(w.findComponent(PynViewNotice).text()).toContain('A confirmation link was sent to carol')
    expect(w.findComponent(PynAccounts).props('resendingUser')).toBe('')
  })

  it.each([
    [409, 'email_already_confirmed', 'already confirmed'],
    [409, 'email_verification_off', 'does not verify email addresses'],
    [404, 'user_not_found', 'does not exist'],
  ])('words %i %s', async (status, code, text) => {
    const w = await open()
    vi.mocked(admin.resendConfirmation).mockRejectedValue(new ApiError(status, code, 'x'))
    await resend(w)
    expect(w.findComponent(PynAccounts).props('error')).toContain(text)
    expect(w.findComponent(PynViewNotice).exists()).toBe(false)
  })

  it('shows the retry time for too_many_attempts', async () => {
    const w = await open()
    vi.mocked(admin.resendConfirmation).mockRejectedValue(
      new ApiError(429, 'too_many_attempts', 'x', 1800),
    )
    await resend(w)
    expect(w.findComponent(PynAccounts).props('error')).toMatch(/Try again in .*30/)
  })
})

describe('email status on Server access', () => {
  const open = async (mailer: 'none' | 'log' | 'smtp', verification: boolean) => {
    vi.mocked(admin.fetchAccessMode).mockResolvedValue({
      initialised: true,
      access_mode: 'private',
      public_url: 'https://pyn.example.com',
      registration: 'invite',
    } as never)
    vi.mocked(admin.fetchAdminSettings).mockResolvedValue({
      email: { mailer, verification },
    } as never)
    const w = mount(AdminAccessView, { global: { provide } })
    await flushPromises()
    return w
  }

  it.each([
    ['none', false, 'None'],
    ['log', false, 'Log only'],
    ['smtp', true, 'SMTP'],
  ] as const)('shows the %s mailer', async (mailer, verification, label) => {
    const w = await open(mailer, verification)
    const status = w.findComponent(PynEmailStatus)
    expect(status.props()).toEqual({ mailer, verification })
    expect(status.text()).toContain(label)
  })

  it('omits the panel when the settings cannot be read', async () => {
    vi.mocked(admin.fetchAccessMode).mockResolvedValue({
      initialised: true,
      public_url: '',
      registration: 'invite',
    } as never)
    vi.mocked(admin.fetchAdminSettings).mockRejectedValue(new Error('x'))
    const w = mount(AdminAccessView, { global: { provide } })
    await flushPromises()
    expect(w.findComponent(PynEmailStatus).exists()).toBe(false)
  })
})
