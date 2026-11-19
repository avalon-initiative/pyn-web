import {
  PynPasskeys,
  PynRecoveryCodes,
  PynTotpEnrolment,
  PynViewNotice,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../src/api/client'
import * as api from '../src/api/two-factor'
import { freshPrompt, withFreshCheck } from '../src/state/fresh.state'
import { twoFactorDue } from '../src/state/two-factor.state'
import SecurityView from '../src/views/SecurityView.vue'

vi.mock('../src/api/two-factor')
vi.mock('../src/state/webauthn.state', async (orig) => ({
  ...(await orig<object>()),
  passkeysSupported: () => true,
  createPasskey: vi.fn(async () => ({ id: 'c', response: {} })),
}))

const off = { enabled: false, factors: [], recovery_codes_left: 0, passkeys_available: true }
const on = {
  enabled: true,
  factors: [{ id: 'f1', kind: 'totp', label: 'phone', created_at: 'x' }],
  passkeys: [],
  passkeys_available: true,
  recovery_codes_left: 9,
}

beforeEach(() => {
  vi.resetAllMocks()
  twoFactorDue.value = null
  vi.mocked(api.fetchTwoFactor).mockResolvedValue(off as never)
  vi.mocked(api.listNotices).mockResolvedValue([])
})
afterEach(() => (twoFactorDue.value = null))

const mountView = async () => {
  const w = mount(SecurityView)
  await flushPromises()
  return w
}

describe('SecurityView', () => {
  it('enrols an authenticator app and shows the recovery codes once', async () => {
    vi.mocked(api.beginTotp).mockResolvedValue({ id: 'e1', secret: 'S', uri: 'otpauth://x' })
    vi.mocked(api.confirmTotp).mockResolvedValue({
      factor: on.factors[0],
      fresh_until: 'x',
      recovery_codes: ['aaaa-bbbb'],
    } as never)
    const w = await mountView()
    await w
      .findAll('button')
      .find((b) => b.text().includes('Add an authenticator'))!
      .trigger('click')
    await flushPromises()
    expect(api.beginTotp).toHaveBeenCalledWith('', undefined)
    vi.mocked(api.fetchTwoFactor).mockResolvedValue(on as never)
    w.findComponent(PynTotpEnrolment).vm.$emit('confirm', '123456')
    await flushPromises()
    expect(api.confirmTotp).toHaveBeenCalledWith('e1', '123456')
    expect(w.findComponent(PynRecoveryCodes).props('codes')).toEqual(['aaaa-bbbb'])
    w.findComponent(PynRecoveryCodes).vm.$emit('saved')
    await flushPromises()
    expect(w.findComponent(PynRecoveryCodes).exists()).toBe(false)
  })

  it('clears the nag once a factor is on', async () => {
    twoFactorDue.value = { by: 'server', deadline: '2026-12-01T00:00:00Z', enforced: false }
    vi.mocked(api.fetchTwoFactor).mockResolvedValue(on as never)
    const w = await mountView()
    expect(twoFactorDue.value).toBeNull()
    expect(w.text()).toContain('9 recovery codes left')
  })

  it('shows the nag from the status and the notices, and dismisses a notice', async () => {
    vi.mocked(api.fetchTwoFactor).mockResolvedValue({
      ...off,
      required: {
        by: 'organization',
        organization: 'acme',
        deadline: '2026-12-01T00:00:00Z',
        enforced: true,
      },
    } as never)
    vi.mocked(api.listNotices).mockResolvedValue([
      { id: 'n1', kind: 'passkey_clone_suspected', detail: 'd', created_at: 'x' },
    ])
    vi.mocked(api.dismissNotice).mockResolvedValue(undefined)
    const w = await mountView()
    const text = w.findAllComponents(PynViewNotice).map((n) => n.text())
    expect(text[0]).toContain('The organization acme requires two-factor authentication')
    expect(text[1]).toContain('copied')
    await w
      .findAll('button')
      .find((b) => b.text() === 'Dismiss')!
      .trigger('click')
    await flushPromises()
    expect(api.dismissNotice).toHaveBeenCalledWith('n1')
    expect(w.text()).not.toContain('copied')
  })

  it('registers a passkey and keeps the recovery codes of a first factor', async () => {
    vi.mocked(api.beginPasskeyRegistration).mockResolvedValue({
      ceremony: 'c1',
      public_key: {},
      expires_at: 'x',
    } as never)
    vi.mocked(api.finishPasskeyRegistration).mockResolvedValue({
      passkey: {},
      fresh_until: 'x',
      recovery_codes: ['r1'],
    } as never)
    const w = await mountView()
    w.findComponent(PynPasskeys).vm.$emit('add')
    await flushPromises()
    expect(api.finishPasskeyRegistration).toHaveBeenCalledWith('c1', { id: 'c', response: {} })
    expect(w.findComponent(PynRecoveryCodes).props('codes')).toEqual(['r1'])
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

  it('regenerates recovery codes and shows them', async () => {
    vi.mocked(api.fetchTwoFactor).mockResolvedValue(on as never)
    vi.mocked(api.regenerateRecoveryCodes).mockResolvedValue(['n1', 'n2'])
    const w = await mountView()
    await w
      .findAll('button')
      .find((b) => b.text().includes('Generate new'))!
      .trigger('click')
    await flushPromises()
    expect(w.findComponent(PynRecoveryCodes).props('codes')).toEqual(['n1', 'n2'])
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
