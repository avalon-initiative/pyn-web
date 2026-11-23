import { PynWebhookDetail, PynWebhookForm, PynWebhooks } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { ApiError } from '../src/api/client'
import { sessionKey } from '../src/state/context.state'
import { toEventTypeOptions, webhookError } from '../src/state/webhooks.state'
import AdminWebhooksView from '../src/views/AdminWebhooksView.vue'

const types = [
  { name: 'repository.created', description: 'A repository was created.' },
  { name: 'lock.acquired', description: 'A lock was taken.' },
  { name: 'user.created', description: 'An account was created.' },
]
const hook = (over = {}) => ({
  id: 1,
  name: 'hook-1',
  url: 'https://example.com/h',
  enabled: true,
  event_types: [],
  secrets: [{ id: 11, created_at: '2026-10-01T00:00:00Z', encrypted: true }],
  created_by: 'root',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  ...over,
})
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Sent = { method: string; url: string; body: string }

describe('webhook event types state', () => {
  it('maps the server list to options with the description', () => {
    expect(toEventTypeOptions(types)[1]).toEqual({
      value: 'lock.acquired',
      label: 'lock.acquired',
      description: 'A lock was taken.',
    })
  })

  it('words a refused request and leaves other errors alone', () => {
    const refused = webhookError(new ApiError(400, 'invalid_request', 'unknown event type "x"'))
    expect(refused).toContain('The server did not accept this webhook')
    expect(refused).toContain('unknown event type "x"')
    expect(webhookError(new ApiError(404, 'not_found', 'gone'))).toBe('gone')
  })
})

describe('webhook forms with the server event types', () => {
  const sent: Sent[] = []
  let handler: (s: Sent) => Response

  const view = () =>
    mount(AdminWebhooksView, {
      attachTo: document.body,
      global: {
        provide: {
          [sessionKey as symbol]: { user: ref('root'), admin: ref(true), expire: vi.fn() },
        },
      },
    })
  type Wrapper = ReturnType<typeof view>
  const startCreate = async (w: Wrapper) => {
    w.findComponent(PynWebhooks).vm.$emit('create')
    await flushPromises()
  }
  const pick = async (w: Wrapper, name: string) => {
    const form = w
    if (!document.querySelector('[role=listbox]'))
      await form.find('button[role=combobox]').trigger('click')
    const option = [...document.querySelectorAll('[role=option]')].find((o) =>
      o.textContent?.includes(name),
    )
    ;(option as HTMLElement).click()
    await flushPromises()
  }
  const posts = (method: string) => sent.filter((s) => s.method === method)

  beforeEach(() => {
    sent.length = 0
    handler = (s) => {
      if (s.url === '/v1/admin/webhooks/event-types') return json(types)
      if (s.url === '/v1/admin/webhooks' && s.method === 'GET') return json([hook()])
      if (s.url === '/v1/admin/webhooks/1' && s.method === 'GET') return json(hook())
      if (s.url.startsWith('/v1/admin/webhooks/1/deliveries'))
        return json({ deliveries: [], next_before: null })
      if (s.method === 'POST') return json({ webhook: hook(), secret: 'pyn_whsec_x' }, 201)
      return json({})
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const s = { method: init?.method ?? 'GET', url, body: String(init?.body ?? '') }
        sent.push(s)
        return handler(s)
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('reads the event types once and passes options to the create form', async () => {
    const w = view()
    await flushPromises()
    await startCreate(w)
    const form = w.findComponent(PynWebhookForm)
    expect(form.props('eventTypeOptions')).toEqual(toEventTypeOptions(types))
    expect(form.props('eventTypesLoading')).toBe(false)
    expect(form.props('eventTypesError')).toBe('')
    expect(sent.filter((s) => s.url === '/v1/admin/webhooks/event-types')).toHaveLength(1)
  })

  it('passes the loading flag while the list is on its way', async () => {
    let release: (r: Response) => void = () => {}
    handler = (s) =>
      s.url === '/v1/admin/webhooks/event-types'
        ? (new Promise((r) => (release = r)) as never)
        : json([])
    const w = view()
    await flushPromises()
    await startCreate(w)
    expect(w.findComponent(PynWebhookForm).props('eventTypesLoading')).toBe(true)
    release(json(types))
    await flushPromises()
    expect(w.findComponent(PynWebhookForm).props('eventTypesLoading')).toBe(false)
  })

  it('passes a load error to the form', async () => {
    const base = handler
    handler = (s) =>
      s.url === '/v1/admin/webhooks/event-types'
        ? json({ code: 'server_admin_required', message: 'no' }, 403)
        : base(s)
    const w = view()
    await flushPromises()
    await startCreate(w)
    expect(w.findComponent(PynWebhookForm).props('eventTypesError')).toContain(
      'Could not load the event types.',
    )
  })

  it('chooses and removes types, then submits them as a list', async () => {
    const w = view()
    await flushPromises()
    await startCreate(w)
    await w.findComponent(PynWebhookForm).find('input').setValue('ci')
    await w.find('input[type=url]').setValue('https://ci.example.com/hook')
    await pick(w, 'repository.created')
    await pick(w, 'lock.acquired')
    expect(w.findAll('[data-test=chip]')).toHaveLength(2)
    await w.find('button[aria-label="Remove lock.acquired"]').trigger('click')
    expect(w.findAll('[data-test=chip]')).toHaveLength(1)
    await w.find('form').trigger('submit')
    await flushPromises()
    const post = posts('POST')[0]
    expect(post.url).toBe('/v1/admin/webhooks')
    expect(JSON.parse(post.body).event_types).toEqual(['repository.created'])
  })

  it('shows a clear message when the server refuses the submission', async () => {
    const base = handler
    handler = (s) =>
      s.method === 'POST'
        ? json({ code: 'invalid_request', message: 'unknown event type "x.y"' }, 400)
        : base(s)
    const w = view()
    await flushPromises()
    await startCreate(w)
    await w.findComponent(PynWebhookForm).find('input').setValue('ci')
    await w.find('input[type=url]').setValue('https://ci.example.com/hook')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.findComponent(PynWebhookForm).props('error')).toContain(
      'The server did not accept this webhook: unknown event type "x.y"',
    )
  })

  it('keeps a stored type the server no longer lists and marks it unknown', async () => {
    const base = handler
    handler = (s) =>
      s.url === '/v1/admin/webhooks/1' && s.method === 'GET'
        ? json(hook({ event_types: ['repository.created', 'old.removed'] }))
        : s.url === '/v1/admin/webhooks'
          ? json([hook({ event_types: ['repository.created', 'old.removed'] })])
          : base(s)
    const w = view()
    await flushPromises()
    w.findComponent(PynWebhooks).vm.$emit('select', 1)
    await flushPromises()
    const detail = w.findComponent(PynWebhookDetail)
    expect(detail.props('eventTypeOptions')).toEqual(toEventTypeOptions(types))
    await detail
      .findAll('button')
      .find((b) => b.text() === 'Edit')!
      .trigger('click')
    await flushPromises()
    const chips = w.findAll('[data-test=chip]').map((c) => c.text())
    expect(chips.some((c) => c.startsWith('old.removed (unknown)'))).toBe(true)
    await detail.find('form').trigger('submit')
    await flushPromises()
    const patch = posts('PATCH')[0]
    expect(JSON.parse(patch.body).event_types).toEqual(['repository.created', 'old.removed'])
  })
})
