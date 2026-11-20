import { PynUpdateNotice } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { sessionKey } from '../src/state/context.state'
import { resetUpdateNotice } from '../src/state/update-notice.state'
import AdminView from '../src/views/AdminView.vue'

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const newer = {
  enabled: true,
  current: '0.1.7',
  latest: '0.1.9',
  prerelease: false,
  url: 'https://example.com/notes',
  checked_at: '2026-11-20T10:00:00Z',
}

async function open(update: () => Promise<Response>, admin = true) {
  const fetched: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      fetched.push(url)
      if (url.startsWith('/v1/admin/update')) return update()
      return json({ entries: [], next_before: null })
    }),
  )
  const router = makeRouter(createMemoryHistory())
  await router.push('/_/admin/audit')
  await router.isReady()
  const w = mount(AdminView, {
    global: {
      plugins: [router],
      provide: {
        [sessionKey as symbol]: { user: ref('root'), admin: ref(admin), expire: vi.fn() },
      },
      stubs: { RouterView: false },
    },
  })
  await flushPromises()
  return { w, fetched }
}

describe('server update notice', () => {
  beforeEach(resetUpdateNotice)
  afterEach(() => vi.unstubAllGlobals())

  it('shows for an administrator when a newer release exists', async () => {
    const { w, fetched } = await open(() => json(newer))
    const n = w.findComponent(PynUpdateNotice)
    expect(n.exists()).toBe(true)
    expect(n.props()).toMatchObject({
      current: '0.1.7',
      latest: '0.1.9',
      prerelease: false,
      url: 'https://example.com/notes',
    })
    expect(fetched).toContain('/v1/admin/update')
  })

  it('passes the pre-release flag through', async () => {
    const { w } = await open(() => json({ ...newer, prerelease: true }))
    expect(w.findComponent(PynUpdateNotice).props('prerelease')).toBe(true)
  })

  it.each([
    ['the check is off', () => json({ enabled: false, current: '0.1.7' })],
    ['no lookup has succeeded yet', () => json({ enabled: true, current: '0.1.7' })],
    [
      'the server is up to date',
      () => json({ enabled: true, current: '0.1.7', checked_at: '2026-11-20T10:00:00Z' }),
    ],
    ['the route is missing (older server)', () => json({ code: 'not_found' }, 404)],
    ['the account is refused', () => json({ code: 'forbidden' }, 403)],
    ['the session is gone', () => json({ code: 'unauthorized' }, 401)],
    ['the network fails', () => Promise.reject(new Error('offline'))],
  ])('shows nothing when %s', async (_, update) => {
    const { w } = await open(update)
    expect(w.findComponent(PynUpdateNotice).exists()).toBe(false)
  })

  it('does not ask when the account is not an administrator', async () => {
    const { w, fetched } = await open(() => json(newer), false)
    expect(w.findComponent(PynUpdateNotice).exists()).toBe(false)
    expect(fetched).not.toContain('/v1/admin/update')
  })

  it('stays hidden after a dismissal', async () => {
    const { w } = await open(() => json(newer))
    w.findComponent(PynUpdateNotice).vm.$emit('dismiss')
    await flushPromises()
    expect(w.findComponent(PynUpdateNotice).exists()).toBe(false)
    const again = await open(() => json(newer))
    expect(again.w.findComponent(PynUpdateNotice).exists()).toBe(false)
  })
})
