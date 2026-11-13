import { PynPasswordForm, accountNavItems } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { changePassword } from '../src/api/password'
import { ApiError } from '../src/api/client'
import { makeRouter } from '../src/router'
import { PASSWORD_CHANGED, passwordError } from '../src/state/password.state'
import PasswordView from '../src/views/PasswordView.vue'

vi.mock('../src/api/password')

const submitForm = async (w: ReturnType<typeof mountView>) => {
  w.findComponent(PynPasswordForm).vm.$emit('submit', {
    current: 'old-password',
    next: 'new-password-1',
  })
  await flushPromises()
}

const mountView = () => mount(PasswordView)

beforeEach(() => {
  vi.mocked(changePassword).mockReset()
})

describe('PasswordView', () => {
  it('sends the passwords and says other sessions end while this one stays', async () => {
    vi.mocked(changePassword).mockResolvedValue(undefined)
    const w = mountView()
    await submitForm(w)
    expect(changePassword).toHaveBeenCalledWith('old-password', 'new-password-1')
    const form = w.findComponent(PynPasswordForm)
    expect(form.props('success')).toBe(PASSWORD_CHANGED)
    expect(form.props('error')).toBe('')
    expect(PASSWORD_CHANGED).toContain('this session stays signed in')
  })

  it('passes the length rules to the form', () => {
    const form = mountView().findComponent(PynPasswordForm)
    expect(form.props('minLength')).toBe(10)
    expect(form.props('rules')?.[0]).toContain('256')
  })

  it('reports a wrong current password without ending the session', async () => {
    vi.mocked(changePassword).mockImplementation(async () => {
      throw new ApiError(401, 'unauthenticated', 'the current password is wrong')
    })
    const w = mountView()
    await submitForm(w)
    expect(w.findComponent(PynPasswordForm).props('error')).toBe('The current password is wrong.')
    expect(w.findComponent(PynPasswordForm).props('success')).toBe('')
  })

  it('words a rate limit with the wait', async () => {
    vi.mocked(changePassword).mockImplementation(async () => {
      throw new ApiError(429, 'too_many_attempts', 'x', 780)
    })
    const w = mountView()
    await submitForm(w)
    const text = w.findComponent(PynPasswordForm).props('error')
    expect(text).toContain('Too many attempts. Try again in')
    expect(text).toContain('13')
  })

  it('shows the server message for a validation error', () => {
    expect(
      passwordError(
        new ApiError(400, 'invalid_request', 'a password needs at least 10 characters'),
      ),
    ).toBe('a password needs at least 10 characters')
  })

  it('says why an external sign-in account cannot use it', () => {
    expect(mountView().text()).toContain('no password yet')
  })
})

describe('password route', () => {
  it('redirects /_/settings to the password page', async () => {
    const router = makeRouter(createMemoryHistory())
    await router.push('/_/settings')
    expect(router.currentRoute.value.fullPath).toBe('/_/settings/password')
    expect(router.currentRoute.value.name).toBe('password')
  })

  it('has a Password nav item for the page', () => {
    const item = accountNavItems(false).find((i) => i.id === 'password')
    expect(item?.href).toBe('/_/settings/password')
  })
})
