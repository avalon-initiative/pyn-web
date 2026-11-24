import { PynBranchesPage } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { repoKey } from '../src/state/context.state'
import RepoBranchesView from '../src/views/RepoBranchesView.vue'

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))
const branch = (name: string, def = false) => ({
  name,
  default: def,
  commit: 'a'.repeat(40),
  created_at: '2026-10-01T09:00:00Z',
  created_by: 'bob',
  updated_at: '2026-10-02T09:00:00Z',
})

async function open(
  opts: { permissions?: string[]; frozen?: boolean; url?: string; deleteReply?: Response[] } = {},
) {
  const calls: { url: string; method: string; body?: string }[] = []
  const replies = [...(opts.deleteReply ?? [new Response(null, { status: 204 })])]
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push({ url, method, body: init?.body as string | undefined })
      if (method === 'DELETE') return Promise.resolve(replies.shift()!)
      if (method === 'POST') return json(branch('new'))
      if (url.includes('/compare'))
        return json({ base: 'main', head: 'x', status: 'ahead', ahead: 1, behind: 0, changes: [] })
      return json([branch('main', true), branch('feature/x')])
    }),
  )
  const reloadBranches = vi.fn(() => Promise.resolve())
  const router = makeRouter(createMemoryHistory())
  await router.push(opts.url ?? '/acme/game/branches')
  const w = mount(RepoBranchesView, {
    global: {
      plugins: [router],
      provide: {
        [repoKey as symbol]: {
          target: ref({ owner: 'acme', name: 'game' }),
          permissions: ref(opts.permissions ?? ['read', 'checkin']),
          frozen: ref(opts.frozen ?? false),
          reloadBranches,
        },
      },
    },
  })
  await flushPromises()
  return { w, calls, reloadBranches }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('branches page', () => {
  it('links the views and picks the view from the address', async () => {
    const page = (await open({ url: '/acme/game/branches?view=all' })).w.findComponent(
      PynBranchesPage,
    )
    expect(page.props('view')).toBe('all')
    expect(page.props('hrefs')).toEqual({
      branches: '/acme/game/branches',
      all: '/acme/game/branches?view=all',
    })
    expect(page.props('yours')).toBeUndefined()
    expect(page.props('active')).toBeUndefined()
    expect(page.props('stale')).toBeUndefined()
  })

  it('offers New branch and Delete only with checkin on an unfrozen owner', async () => {
    const writer = (await open()).w.findComponent(PynBranchesPage)
    expect(writer.props('canCreate')).toBe(true)
    expect(writer.props('canDelete')).toBe(true)
    for (const o of [{ permissions: ['read'] }, { frozen: true }]) {
      const page = (await open(o)).w.findComponent(PynBranchesPage)
      expect(page.props('canCreate')).toBe(false)
      expect(page.props('canDelete')).toBe(false)
    }
  })

  it('creates a branch from the typed name and refreshes the lists', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue(' topic ')
    const { w, calls, reloadBranches } = await open()
    w.findComponent(PynBranchesPage).vm.$emit('newBranch')
    await flushPromises()
    const post = calls.find((c) => c.method === 'POST')!
    expect(post.url).toBe('/v1/repos/acme/game/branches')
    expect(JSON.parse(post.body!)).toEqual({ name: 'topic' })
    expect(reloadBranches).toHaveBeenCalled()
  })

  it('does nothing when the name prompt is cancelled', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null)
    const { w, calls } = await open()
    w.findComponent(PynBranchesPage).vm.$emit('newBranch')
    await flushPromises()
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('deletes after a confirmation and not when it is declined', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { w, calls } = await open()
    const page = w.findComponent(PynBranchesPage)
    page.vm.$emit('delete', 'feature/x')
    await flushPromises()
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)
    confirm.mockReturnValue(true)
    page.vm.$emit('delete', 'feature/x')
    await flushPromises()
    const del = calls.find((c) => c.method === 'DELETE')!
    expect(del.url).toBe('/v1/repos/acme/game/branches/feature%2Fx')
  })

  it('offers a forced delete for a branch that is not merged', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { w, calls } = await open({
      deleteReply: [
        new Response(JSON.stringify({ code: 'branch_not_merged', message: 'x' }), { status: 409 }),
        new Response(null, { status: 204 }),
      ],
    })
    w.findComponent(PynBranchesPage).vm.$emit('delete', 'feature/x')
    await flushPromises()
    const dels = calls.filter((c) => c.method === 'DELETE')
    expect(dels).toHaveLength(2)
    expect(dels[1].url).toContain('force=true')
  })
})
