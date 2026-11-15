import {
  PynEmailAddresses,
  PynProfileForm,
  PynUsernameChange,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import * as admin from '../src/api/admin'
import * as auth from '../src/api/auth'
import * as emails from '../src/api/emails'
import * as profile from '../src/api/profile'
import * as repos from '../src/api/repos'
import * as username from '../src/api/username'
import { ApiError } from '../src/api/client'
import { makeRouter } from '../src/router'
import { sessionKey } from '../src/state/context.state'
import EmailAddressesView from '../src/views/EmailAddressesView.vue'
import ProfileSettingsView from '../src/views/ProfileSettingsView.vue'
import UsernameView from '../src/views/UsernameView.vue'

vi.mock('../src/api/admin')
vi.mock('../src/api/auth')
vi.mock('../src/api/emails')
vi.mock('../src/api/profile')
vi.mock('../src/api/repos')
vi.mock('../src/api/username')

const user = ref('root')
const provide = { [sessionKey as symbol]: { user, admin: ref(false), expire: vi.fn() } }
const mountView = (c: object) => mount(c, { global: { provide } })

beforeEach(() => {
  vi.resetAllMocks()
  user.value = 'root'
  vi.mocked(admin.fetchMe).mockResolvedValue({
    id: 'a',
    user: 'root',
    has_password: true,
    profile: { display_name: 'Root' },
  })
})

describe('account settings routes', () => {
  it.each([
    ['/_/settings/profile', 'profile-settings'],
    ['/_/settings/emails', 'emails'],
    ['/_/settings/username', 'username'],
  ])('routes %s', (path, name) => {
    expect(makeRouter(createMemoryHistory()).resolve(path).name).toBe(name)
  })
})

describe('ProfileSettingsView', () => {
  it('loads the profile and saves it', async () => {
    const saved = { display_name: 'New', avatar_url: '/a?v=1' }
    vi.mocked(profile.saveProfile).mockResolvedValue(saved)
    const w = mountView(ProfileSettingsView)
    await flushPromises()
    const form = w.findComponent(PynProfileForm)
    expect(form.props('profile')).toEqual({ display_name: 'Root' })
    form.vm.$emit('save', { display_name: 'New' })
    await flushPromises()
    expect(profile.saveProfile).toHaveBeenCalledWith({ display_name: 'New' })
    expect(form.props('success')).toBe('Profile saved.')
    expect(form.props('avatarUrl')).toBe('/a?v=1')
  })

  it('uploads and removes the avatar, showing server errors', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    vi.mocked(profile.uploadAvatar).mockRejectedValue(new ApiError(413, 'too_large', 'too big'))
    vi.mocked(profile.removeAvatar).mockResolvedValue({})
    const w = mountView(ProfileSettingsView)
    await flushPromises()
    const form = w.findComponent(PynProfileForm)
    form.vm.$emit('avatar', file)
    await flushPromises()
    expect(profile.uploadAvatar).toHaveBeenCalledWith(file)
    expect(form.props('avatarError')).not.toBe('')
    form.vm.$emit('removeAvatar')
    await flushPromises()
    expect(profile.removeAvatar).toHaveBeenCalled()
    expect(form.props('avatarError')).toBe('')
  })
})

describe('EmailAddressesView', () => {
  const list = [
    { address: 'a@x.io', verified: true, primary: true, added_at: '2026-01-01T00:00:00Z' },
  ]

  it('adds, then refetches and marks the address as sent', async () => {
    vi.mocked(emails.listEmails).mockResolvedValue(list)
    vi.mocked(emails.addEmail).mockResolvedValue(list[0]!)
    const w = mountView(EmailAddressesView)
    await flushPromises()
    const c = w.findComponent(PynEmailAddresses)
    c.vm.$emit('add', 'b@x.io')
    await flushPromises()
    expect(emails.addEmail).toHaveBeenCalledWith('b@x.io')
    expect(emails.listEmails).toHaveBeenCalledTimes(2)
    expect(c.props('sent')).toBe('b@x.io')
  })

  it('sets primary, removes and surfaces a refusal', async () => {
    vi.mocked(emails.listEmails).mockResolvedValue(list)
    const w = mountView(EmailAddressesView)
    await flushPromises()
    const c = w.findComponent(PynEmailAddresses)
    c.vm.$emit('primary', 'a@x.io')
    c.vm.$emit('remove', 'a@x.io')
    await flushPromises()
    expect(emails.setPrimaryEmail).toHaveBeenCalledWith('a@x.io')
    expect(emails.removeEmail).toHaveBeenCalledWith('a@x.io')
    vi.mocked(emails.resendEmail).mockRejectedValue(new ApiError(409, 'email_unavailable', 'taken'))
    c.vm.$emit('resend', 'a@x.io')
    await flushPromises()
    expect(c.props('error')).not.toBe('')
  })
})

describe('UsernameView', () => {
  it('passes the account state and refreshes the session after a rename', async () => {
    vi.mocked(repos.listRepos).mockResolvedValue([{ owner: 'root', name: 'game' } as never])
    vi.mocked(username.renameAccount).mockResolvedValue({
      old_name: 'root',
      new_name: 'boss',
      repositories: ['boss/game'],
    })
    vi.mocked(auth.restoreSession).mockResolvedValue({ user: 'boss', csrf_token: 't' } as never)
    const w = mountView(UsernameView)
    await flushPromises()
    const c = w.findComponent(PynUsernameChange)
    expect(c.props('hasPassword')).toBe(true)
    expect(c.props('repositories')).toEqual(['root/game'])
    c.vm.$emit('rename', { username: 'boss', password: 'pw' })
    await flushPromises()
    expect(username.renameAccount).toHaveBeenCalledWith({ username: 'boss', password: 'pw' })
    expect(user.value).toBe('boss')
    expect(c.props('repositories')).toEqual(['boss/game'])
  })

  it('shows a refusal', async () => {
    vi.mocked(repos.listRepos).mockResolvedValue([])
    vi.mocked(username.renameAccount).mockRejectedValue(new ApiError(409, 'user_exists', 'taken'))
    const w = mountView(UsernameView)
    await flushPromises()
    const c = w.findComponent(PynUsernameChange)
    c.vm.$emit('rename', { username: 'boss' })
    await flushPromises()
    expect(c.props('error')).not.toBe('')
    expect(user.value).toBe('root')
  })
})
