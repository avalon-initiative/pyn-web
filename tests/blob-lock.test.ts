import { PynFileView } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { repoKey, sessionKey } from '../src/state/context.state'
import RepoBlobView from '../src/views/RepoBlobView.vue'

const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body)))
const entry = {
  name: 'a.bin',
  path: 'a.bin',
  kind: 'file',
  mode: 'exclusive',
  last_change: {
    id: 7,
    path: 'a.bin',
    author: 'bob',
    commit: 'a'.repeat(40),
    file_mode: '100644',
    hash: 'b'.repeat(64),
    hash_version: 1,
    message: 'm',
    content: 'c0ffee',
    created_at: '2026-10-01T00:00:00Z',
  },
}

async function open(permissions: string[], frozen = false) {
  const calls: { url: string; body?: string }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body as string | undefined })
      if (url.includes('/tree')) return json({ path: '', entries: [entry] })
      if (url.includes('/policy')) return json({ paths: [] })
      if (url.includes('/content')) return Promise.resolve(new Response(new Uint8Array([1])))
      if (url.endsWith('/checkout')) return json({ path: 'a.bin', owner: 'alice' })
      return json({})
    }),
  )
  const router = makeRouter(createMemoryHistory())
  await router.push('/acme/game/blob/a.bin')
  const w = mount(RepoBlobView, {
    global: {
      plugins: [router],
      provide: {
        [repoKey as symbol]: {
          target: ref({ owner: 'acme', name: 'game' }),
          permissions: ref(permissions),
          frozen: ref(frozen),
        },
        [sessionKey as symbol]: { user: ref('alice'), admin: ref(false) },
      },
    },
  })
  await flushPromises()
  return { w, calls }
}

afterEach(() => vi.unstubAllGlobals())

describe('file view locking', () => {
  it('offers Lock with the lock permission and checks the file out at its revision', async () => {
    const { w, calls } = await open(['read', 'lock'])
    const view = w.findComponent(PynFileView)
    expect(view.props('lockable')).toBe(true)
    view.vm.$emit('lock')
    await flushPromises()
    const post = calls.find((c) => c.url.endsWith('/checkout'))
    expect(JSON.parse(post!.body!)).toEqual({ path: 'a.bin', base_revision: 7 })
  })

  it('is not lockable without the permission or when the owner is frozen', async () => {
    expect((await open(['read'])).w.findComponent(PynFileView).props('lockable')).toBe(false)
    expect(
      (await open(['read', 'lock'], true)).w.findComponent(PynFileView).props('lockable'),
    ).toBe(false)
  })
})
