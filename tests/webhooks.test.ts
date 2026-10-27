import {
  PynDrawer,
  PynPageNotFound,
  PynWebhookDetail,
  PynWebhooks,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { sessionKey } from '../src/state/context.state'
import { activeNav, sideNavItems } from '../src/state/shell.state'
import { asStatus, replaceById, toViewDelivery } from '../src/state/webhooks.state'
import AdminWebhooksView from '../src/views/AdminWebhooksView.vue'

void createRouter

const hook = (id: number, over = {}) => ({
  id,
  name: `hook-${id}`,
  url: 'https://example.com/h',
  enabled: true,
  event_types: [],
  secrets: [{ id: 10 + id, created_at: '2026-10-01T00:00:00Z', encrypted: true }],
  created_by: 'root',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  ...over,
})
const delivery = (id: string, event_id: number, over = {}) => ({
  id,
  status: 'failed',
  attempts: 3,
  created_at: '2026-10-02T00:00:00Z',
  failed_at: '2026-10-02T00:05:00Z',
  next_attempt_at: '2026-10-02T00:05:00Z',
  last_status_code: 500,
  last_error: 'boom',
  event_id,
  ...over,
})
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Sent = { method: string; url: string; body: string }

describe('webhooks state', () => {
  it('types the event id as text for the library', () => {
    expect(toViewDelivery(delivery('d', 7) as never).event_id).toBe('7')
  })

  it('replaces by id and narrows the status filter', () => {
    const next = hook(2, { name: 'renamed' })
    expect(replaceById([hook(1), hook(2)], next as never)[1].name).toBe('renamed')
    expect(asStatus('failed')).toBe('failed')
    expect(asStatus('bogus')).toBe('')
  })

  it('adds the Webhooks page to the sidebar for administrators only', () => {
    expect(sideNavItems(false).some((i) => i.id === 'webhooks')).toBe(false)
    expect(sideNavItems(true).some((i) => i.href === '/_/admin/webhooks')).toBe(true)
    expect(activeNav('/_/admin/webhooks')).toBe('webhooks')
    expect(makeRouter(createMemoryHistory()).resolve('/_/admin/webhooks').name).toBe(
      'admin-webhooks',
    )
  })
})

describe('AdminWebhooksView', () => {
  const sent: Sent[] = []
  let handler: (s: Sent) => Response
  const expired = vi.fn()

  const view = (admin = true) =>
    mount(AdminWebhooksView, {
      attachTo: document.body,
      global: {
        provide: {
          [sessionKey as symbol]: { user: ref('root'), admin: ref(admin), expire: expired },
        },
      },
    })
  const detail = (w: ReturnType<typeof view>) => w.findComponent(PynWebhookDetail)
  const open = async (w: ReturnType<typeof view>, id = 1) => {
    w.findComponent(PynWebhooks).vm.$emit('select', id)
    await flushPromises()
  }

  beforeEach(() => {
    sent.length = 0
    handler = (s) => {
      if (s.url === '/v1/admin/webhooks') return json([hook(1), hook(2)])
      if (s.url === '/v1/admin/webhooks/1' && s.method === 'GET') return json(hook(1))
      if (s.method === 'GET' && s.url.startsWith('/v1/admin/webhooks/1/deliveries'))
        return json({ deliveries: [delivery('d1', 5)], next_before: 5 })
      return json({})
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const s = { method: init.method ?? 'GET', url, body: String(init.body ?? '') }
        sent.push(s)
        return handler(s)
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('shows not found, and sends nothing, to a non-administrator', async () => {
    const w = view(false)
    await flushPromises()
    expect(w.findComponent(PynPageNotFound).exists()).toBe(true)
    expect(sent).toEqual([])
  })

  it('lists subscriptions and keeps the drawer closed until a row is selected', async () => {
    const w = view()
    await flushPromises()
    expect(w.findComponent(PynWebhooks).props('webhooks')).toHaveLength(2)
    expect(w.findComponent(PynDrawer).props('open')).toBe(false)
    await open(w)
    expect(w.findComponent(PynDrawer).props('open')).toBe(true)
    expect(detail(w).props('webhook').name).toBe('hook-1')
    expect(detail(w).props('deliveries')[0].event_id).toBe('5')
    expect(detail(w).props('deliveriesHasMore')).toBe(true)
    w.findComponent(PynDrawer).vm.$emit('close')
    await flushPromises()
    expect(w.findComponent(PynDrawer).props('open')).toBe(false)
  })

  it('filters by status, pages with the event id cursor and redelivers', async () => {
    const w = view()
    await flushPromises()
    await open(w)
    detail(w).vm.$emit('filter', 'failed')
    await flushPromises()
    expect(sent.at(-1)!.url).toBe('/v1/admin/webhooks/1/deliveries?status=failed')
    detail(w).vm.$emit('load-more')
    await flushPromises()
    expect(sent.at(-1)!.url).toBe('/v1/admin/webhooks/1/deliveries?status=failed&before=5')
    expect(detail(w).props('deliveries')).toHaveLength(2)

    handler = () => json(delivery('d1', 5, { status: 'pending', attempts: 0, last_error: null }))
    detail(w).vm.$emit('redeliver', 'd1')
    await flushPromises()
    const last = sent.at(-1)!
    expect(last.method).toBe('POST')
    expect(last.url).toBe('/v1/admin/webhooks/1/deliveries/d1/redeliver')
    expect(detail(w).props('deliveries')[0].status).toBe('pending')
    expect(detail(w).props('redeliveringId')).toBe('')
  })

  it('edits through PATCH and deletes, closing the drawer', async () => {
    const w = view()
    await flushPromises()
    await open(w)
    handler = () => json(hook(1, { name: 'renamed' }))
    detail(w).vm.$emit('update', { name: 'renamed' })
    await flushPromises()
    const patch = sent.at(-1)!
    expect([patch.method, patch.url, JSON.parse(patch.body)]).toEqual([
      'PATCH',
      '/v1/admin/webhooks/1',
      { name: 'renamed' },
    ])
    expect(w.findComponent(PynWebhooks).props('webhooks')[0].name).toBe('renamed')

    handler = () => new Response(null, { status: 204 })
    detail(w).vm.$emit('delete', 1)
    await flushPromises()
    expect(sent.at(-1)!.method).toBe('DELETE')
    expect(
      w
        .findComponent(PynWebhooks)
        .props('webhooks')
        .map((h: { id: number }) => h.id),
    ).toEqual([2])
    expect(w.findComponent(PynDrawer).props('open')).toBe(false)
  })

  it('shows a rotated secret once, then clears it on dismiss, close and reselect', async () => {
    const w = view()
    await flushPromises()
    await open(w)
    const rotated = hook(1, {
      secrets: [
        { id: 11, created_at: '2026-10-01T00:00:00Z', encrypted: true },
        { id: 12, created_at: '2026-10-03T00:00:00Z', encrypted: true },
      ],
    })
    handler = (s) => {
      if (s.url.includes('/deliveries')) return json({ deliveries: [], next_before: null })
      if (s.method === 'POST')
        return json({ secret: 'whsec_new', secret_id: 12, created_at: '2026-10-03T00:00:00Z' })
      return json(rotated)
    }
    detail(w).vm.$emit('rotate-secret', 1)
    await flushPromises()
    expect(sent.find((s) => s.url === '/v1/admin/webhooks/1/secrets')!.method).toBe('POST')
    expect(detail(w).props('secret')).toBe('whsec_new')
    expect(detail(w).props('webhook').secrets).toHaveLength(2)

    detail(w).vm.$emit('dismiss')
    await flushPromises()
    expect(detail(w).props('secret')).toBe('')

    detail(w).vm.$emit('rotate-secret', 1)
    await flushPromises()
    w.findComponent(PynDrawer).vm.$emit('close')
    await flushPromises()
    await open(w)
    expect(detail(w).props('secret')).toBe('')
    expect(document.body.textContent).not.toContain('whsec_new')
  })

  it('retires a secret by id', async () => {
    const w = view()
    await flushPromises()
    await open(w)
    detail(w).vm.$emit('retire-secret', 11)
    await flushPromises()
    const del = sent.find((s) => s.method === 'DELETE')!
    expect(del.url).toBe('/v1/admin/webhooks/1/secrets/11')
  })

  it('shows the server refusal as the error and expires a dead session', async () => {
    handler = () => json({ code: 'server_admin_required', message: 'administrators only' }, 403)
    const w = view()
    await flushPromises()
    expect(w.findComponent(PynWebhooks).props('error')).toContain('server administrator')

    handler = (s) =>
      s.url === '/v1/admin/webhooks'
        ? json([hook(1)])
        : json({ code: 'unauthenticated', message: 'sign in' }, 401)
    const w2 = view()
    await flushPromises()
    await open(w2)
    expect(expired).toHaveBeenCalled()
  })

  it('shows a failed delivery listing in the deliveries error, not the settings error', async () => {
    const w = view()
    await flushPromises()
    handler = (s) =>
      s.url.includes('/deliveries')
        ? json({ code: 'webhook_not_found', message: 'gone' }, 404)
        : json(hook(1))
    await open(w)
    expect(detail(w).props('deliveriesError')).toContain('gone')
    expect(detail(w).props('error')).toBe('')
  })
})
