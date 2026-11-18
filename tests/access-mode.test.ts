import { PynAccessMode } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { accessChecklist } from '../src/state/access.state'
import AdminAccessView from '../src/views/AdminAccessView.vue'

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))
const setup = (access_mode: string, extra = {}) => ({
  initialised: true,
  public_url: 'https://pyn.example.com',
  registration: 'invite',
  access_mode,
  ...extra,
})

describe('accessChecklist', () => {
  it('flags a plain-http address and unprotected open sign-up', () => {
    const items = accessChecklist(
      { public_url: 'http://pyn.local', registration: 'open' },
      { registration: 'open' },
    )
    expect(items.map((i) => [i.id, i.status])).toEqual([
      ['address', 'todo'],
      ['registration', 'todo'],
      ['limits', 'unknown'],
    ])
  })

  it('accepts https and verified or invite-only sign-up', () => {
    const https = 'https://x.example'
    const verified = accessChecklist(
      { public_url: https, registration: 'open' },
      { registration: 'open', email_verification: true },
    )
    expect(verified.slice(0, 2).map((i) => i.status)).toEqual(['ok', 'ok'])
    const invite = accessChecklist({ public_url: https, registration: 'invite' }, null)
    expect(invite[1].status).toBe('ok')
  })
})

describe('AdminAccessView', () => {
  afterEach(() => vi.unstubAllGlobals())

  const stub = (put: () => Promise<Response>) => {
    const calls: { url: string; method: string; body?: string; csrf?: string | null }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        const req = url as unknown as Request | string
        const u = typeof req === 'string' ? req : req.url
        const method = (typeof req === 'string' ? init?.method : req.method) ?? 'GET'
        calls.push({ url: u, method })
        if (method === 'PUT') return put()
        if (u.startsWith('/v1/registration')) return json({ registration: 'invite' })
        return json(setup('private'))
      }),
    )
    return calls
  }

  it('reads the mode from the setup status and shows the checklist', async () => {
    const calls = stub(() => json({ access_mode: 'public' }))
    const w = mount(AdminAccessView)
    await flushPromises()
    const panel = w.findComponent(PynAccessMode)
    expect(panel.props('mode')).toBe('private')
    expect(panel.props('checklist')).toHaveLength(3)
    expect(calls.some((c) => c.url.startsWith('/v1/setup') && c.method === 'GET')).toBe(true)
  })

  it('PUTs the target mode on change and shows the mode now in force', async () => {
    const calls = stub(() => json({ access_mode: 'public' }))
    const w = mount(AdminAccessView)
    await flushPromises()
    w.findComponent(PynAccessMode).vm.$emit('change', 'public')
    await flushPromises()
    expect(calls.filter((c) => c.method === 'PUT').map((c) => c.url)).toEqual(['/v1/admin/access'])
    expect(w.findComponent(PynAccessMode).props('mode')).toBe('public')
  })

  it('keeps the mode and shows the server error on a refusal', async () => {
    stub(() => json({ code: 'server_admin_required', message: 'administrators only' }, 403))
    const w = mount(AdminAccessView)
    await flushPromises()
    w.findComponent(PynAccessMode).vm.$emit('change', 'public')
    await flushPromises()
    const panel = w.findComponent(PynAccessMode)
    expect(panel.props('mode')).toBe('private')
    expect(panel.props('error')).toContain('administrator')
  })
})
