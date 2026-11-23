import {
  PynNotices,
  PynPasskeys,
  PynPasswordPrompt,
  PynRecoveryCodes,
  PynTotpEnrolment,
  PynTwoFactor,
  PynTwoFactorNag,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchMe } from '../src/api/admin'
import { ApiError } from '../src/api/client'
import * as api from '../src/api/two-factor'
import { freshPrompt, withFreshCheck } from '../src/state/fresh.state'
import { twoFactorDue } from '../src/state/two-factor.state'
import SecurityView from '../src/views/SecurityView.vue'

vi.mock('../src/api/two-factor')
vi.mock('../src/api/admin')
vi.mock('../src/state/webauthn.state', async (orig) => ({
  ...(await orig<object>()),
  passkeysSupported: () => true,
  createPasskey: vi.fn(async () => ({ id: 'c', response: {} })),
}))

const off = { enabled: false, factors: [], recovery_codes_left: 0, passkeys_available: true }
const on = {
  enabled: true,
  factors: [{ id: 'f1', kind: 'totp', label: 'phone', created_at: '2026-11-19T00:00:00Z' }],
  passkeys: [],
  passkeys_available: true,
  recovery_codes_left: 9,
}
const due = { by: 'organization', organization: 'acme', deadline: '2026-12-01T00:00:00Z' }

beforeEach(() => {
  vi.resetAllMocks()
  twoFactorDue.value = null
  vi.mocked(api.fetchTwoFactor).mockResolvedValue(off as never)
  vi.mocked(api.listNotices).mockResolvedValue([])
  vi.mocked(fetchMe).mockResolvedValue({ has_password: true } as never)
})
const mounted: ReturnType<typeof mount>[] = []
afterEach(() => {
  twoFactorDue.value = null
  mounted.splice(0).forEach((w) => w.unmount())
})

const mountView = async () => {
  const w = mount(SecurityView)
  mounted.push(w)
  await flushPromises()
  return w
}

describe('SecurityView', () => {
  it('enrols an authenticator app with the password and shows the recovery codes once', async () => {
    vi.mocked(api.beginTotp).mockResolvedValue({ id: 'e1', secret: 'S', uri: 'otpauth://x' })
    vi.mocked(api.confirmTotp).mockResolvedValue({
      factor: on.factors[0],
      fresh_until: 'x',
      recovery_codes: ['aaaa-bbbb'],
    } as never)
    const w = await mountView()
    expect(w.findComponent(PynTwoFactor).props('hasPassword')).toBe(true)
    w.findComponent(PynTwoFactor).vm.$emit('add-totp', 'phone', 'pw')
    await flushPromises()
    expect(api.beginTotp).toHaveBeenCalledWith('phone', 'pw')
    vi.mocked(api.fetchTwoFactor).mockResolvedValue(on as never)
    w.findComponent(PynTotpEnrolment).vm.$emit('confirm', '123456')
    await flushPromises()
    expect(api.confirmTotp).toHaveBeenCalledWith('e1', '123456')
    expect(w.findComponent(PynRecoveryCodes).props('codes')).toEqual(['aaaa-bbbb'])
    w.findComponent(PynRecoveryCodes).vm.$emit('saved')
    await flushPromises()
    expect(w.findComponent(PynRecoveryCodes).exists()).toBe(false)
  })

  it('does not end the session on a wrong password or code', async () => {
    vi.mocked(api.beginTotp).mockRejectedValue(new ApiError(401, 'unauthenticated', 'wrong'))
    const w = await mountView()
    w.findComponent(PynTwoFactor).vm.$emit('add-totp', 'phone', 'bad')
    await flushPromises()
    expect(w.findComponent(PynTwoFactor).props('error')).toBe('wrong')
  })

  it('removes a factor and regenerates recovery codes', async () => {
    vi.mocked(api.fetchTwoFactor).mockResolvedValue(on as never)
    vi.mocked(api.regenerateRecoveryCodes).mockResolvedValue(['n1', 'n2'])
    const w = await mountView()
    w.findComponent(PynTwoFactor).vm.$emit('remove', 'f1')
    await flushPromises()
    expect(api.removeFactor).toHaveBeenCalledWith('f1')
    w.findComponent(PynTwoFactor).vm.$emit('regenerate-codes')
    await flushPromises()
    expect(w.findComponent(PynRecoveryCodes).props('codes')).toEqual(['n1', 'n2'])
  })

  it('clears the nag once a factor is on', async () => {
    twoFactorDue.value = { ...due, enforced: false }
    vi.mocked(api.fetchTwoFactor).mockResolvedValue(on as never)
    const w = await mountView()
    expect(twoFactorDue.value).toBeNull()
    expect(w.findComponent(PynTwoFactorNag).exists()).toBe(false)
  })

  it('shows the nag from the status and the notices, and dismisses a notice', async () => {
    vi.mocked(api.fetchTwoFactor).mockResolvedValue({
      ...off,
      required: { ...due, enforced: true },
    } as never)
    const notice = {
      id: 'n1',
      kind: 'passkey_clone_suspected',
      detail: 'd',
      created_at: '2026-11-19T00:00:00Z',
    }
    vi.mocked(api.listNotices).mockResolvedValue([notice])
    const w = await mountView()
    expect(w.findComponent(PynTwoFactorNag).props('required')).toMatchObject({ enforced: true })
    expect(w.findComponent(PynNotices).props('notices')).toEqual([notice])
    w.findComponent(PynNotices).vm.$emit('dismiss', 'n1')
    await flushPromises()
    expect(api.dismissNotice).toHaveBeenCalledWith('n1')
    expect(w.findComponent(PynNotices).props('notices')).toEqual([])
  })

  const begun = { ceremony: 'c1', public_key: {}, expires_at: 'x' }
  const registered = { passkey: {}, fresh_until: 'x', recovery_codes: ['r1'] }

  it('asks for the password before a first passkey, and keeps the prompt on a wrong one', async () => {
    vi.mocked(api.beginPasskeyRegistration)
      .mockRejectedValueOnce(new ApiError(401, 'unauthenticated', 'wrong'))
      .mockResolvedValueOnce(begun as never)
    vi.mocked(api.finishPasskeyRegistration).mockResolvedValue(registered as never)
    const w = await mountView()
    w.findComponent(PynPasskeys).vm.$emit('add')
    await flushPromises()
    expect(api.beginPasskeyRegistration).not.toHaveBeenCalled()
    w.findComponent(PynPasswordPrompt).vm.$emit('submit', 'bad')
    await flushPromises()
    expect(w.findComponent(PynPasswordPrompt).props('error')).toBe('wrong')
    w.findComponent(PynPasswordPrompt).vm.$emit('submit', 'pw')
    await flushPromises()
    expect(api.beginPasskeyRegistration).toHaveBeenLastCalledWith('pw')
    expect(api.finishPasskeyRegistration).toHaveBeenCalledWith('c1', { id: 'c', response: {} })
    expect(w.findComponent(PynPasswordPrompt).exists()).toBe(false)
    expect(w.findComponent(PynRecoveryCodes).props('codes')).toEqual(['r1'])
  })

  it('cancels the password prompt', async () => {
    const w = await mountView()
    w.findComponent(PynPasskeys).vm.$emit('add')
    await flushPromises()
    w.findComponent(PynPasswordPrompt).vm.$emit('cancel')
    await flushPromises()
    expect(w.findComponent(PynPasswordPrompt).exists()).toBe(false)
  })

  it('skips the prompt for an account that has a factor or no password', async () => {
    vi.mocked(api.beginPasskeyRegistration).mockResolvedValue(begun as never)
    vi.mocked(api.finishPasskeyRegistration).mockResolvedValue({ ...registered } as never)
    vi.mocked(api.fetchTwoFactor).mockResolvedValue(on as never)
    let w = await mountView()
    w.findComponent(PynPasskeys).vm.$emit('add')
    await flushPromises()
    expect(api.beginPasskeyRegistration).toHaveBeenLastCalledWith(undefined)
    vi.mocked(api.fetchTwoFactor).mockResolvedValue(off as never)
    vi.mocked(fetchMe).mockResolvedValue({ has_password: false } as never)
    w = await mountView()
    w.findComponent(PynPasskeys).vm.$emit('add')
    await flushPromises()
    expect(api.beginPasskeyRegistration).toHaveBeenCalledTimes(2)
  })

  it('hides passkey registration when the server cannot', async () => {
    vi.mocked(api.fetchTwoFactor).mockResolvedValue({ ...off, passkeys_available: false } as never)
    const w = await mountView()
    expect(w.findComponent(PynPasskeys).props('available')).toBe(false)
  })

  it('renames and removes a passkey', async () => {
    const w = await mountView()
    w.findComponent(PynPasskeys).vm.$emit('rename', { id: 'p1', name: 'laptop' })
    w.findComponent(PynPasskeys).vm.$emit('remove', 'p1')
    await flushPromises()
    expect(api.renamePasskey).toHaveBeenCalledWith('p1', 'laptop')
    expect(api.removePasskey).toHaveBeenCalledWith('p1')
  })
})

describe('withFreshCheck', () => {
  const stale = () => new ApiError(403, 'fresh_check_required', 'x')

  it('repeats the action once after the prompt passes', async () => {
    const action = vi.fn().mockRejectedValueOnce(stale()).mockResolvedValueOnce('ok')
    const run = withFreshCheck(action)
    await flushPromises()
    expect(freshPrompt.value).not.toBeNull()
    freshPrompt.value!.settle(true)
    expect(await run).toBe('ok')
    expect(action).toHaveBeenCalledTimes(2)
  })

  it('rethrows when the prompt is cancelled, and ignores other errors', async () => {
    const action = vi.fn().mockRejectedValue(stale())
    const run = withFreshCheck(action)
    await flushPromises()
    freshPrompt.value!.settle(false)
    await expect(run).rejects.toMatchObject({ code: 'fresh_check_required' })
    expect(action).toHaveBeenCalledTimes(1)
    await expect(
      withFreshCheck(() => Promise.reject(new ApiError(403, 'forbidden', 'x'))),
    ).rejects.toMatchObject({ code: 'forbidden' })
    expect(freshPrompt.value).toBeNull()
  })
})

describe('unsaved recovery codes', () => {
  it('asks before the page is left while they are shown', async () => {
    vi.mocked(api.regenerateRecoveryCodes).mockResolvedValue(['aaaa-bbbb'])
    vi.mocked(api.fetchTwoFactor).mockResolvedValue(on as never)
    const w = await mountView()
    const leave = () => {
      const e = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(e)
      return e.defaultPrevented
    }
    expect(leave()).toBe(false)
    w.findComponent(PynTwoFactor).vm.$emit('regenerate-codes')
    await flushPromises()
    expect(leave()).toBe(true)
    w.findComponent(PynRecoveryCodes).vm.$emit('saved')
    await flushPromises()
    expect(leave()).toBe(false)
  })
})
