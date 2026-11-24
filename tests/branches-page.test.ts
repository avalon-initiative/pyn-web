import { PynBranchDialog, PynBranchesPage } from '@avalon-initiative/pyn-common-ui'
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
  opts: {
    permissions?: string[]
    frozen?: boolean
    url?: string
    deleteReply?: Response[]
    postReply?: Promise<Response>[]
  } = {},
) {
  const calls: { url: string; method: string; body?: string }[] = []
  const replies = [...(opts.deleteReply ?? [new Response(null, { status: 204 })])]
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push({ url, method, body: init?.body as string | undefined })
      if (method === 'PATCH') return json(branch('feature/y'))
      if (method === 'DELETE') return Promise.resolve(replies.shift()!)
      if (method === 'POST') return opts.postReply?.shift() ?? json(branch('new'))
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
    expect(writer.props('canRename')).toBe(true)
    for (const o of [{ permissions: ['read'] }, { frozen: true }]) {
      const page = (await open(o)).w.findComponent(PynBranchesPage)
      expect(page.props('canCreate')).toBe(false)
      expect(page.props('canDelete')).toBe(false)
    }
  })

  const dialog = (w: Awaited<ReturnType<typeof open>>['w']) =>
    w.findAllComponents(PynBranchDialog).at(-1)!

  it('opens the create dialog and creates a branch from the chosen start', async () => {
    const { w, calls, reloadBranches } = await open()
    expect(dialog(w).props('open')).toBe(false)
    w.findComponent(PynBranchesPage).vm.$emit('newBranch')
    await flushPromises()
    expect(dialog(w).props('open')).toBe(true)
    expect(dialog(w).props('mode')).toBe('create')
    dialog(w).vm.$emit('create', { name: 'topic', from: 'feature/x' })
    await flushPromises()
    const post = calls.find((c) => c.method === 'POST')!
    expect(post.url).toBe('/v1/repos/acme/game/branches')
    expect(JSON.parse(post.body!)).toEqual({ name: 'topic', start: 'feature/x' })
    expect(reloadBranches).toHaveBeenCalled()
    expect(dialog(w).props('open')).toBe(false)
  })

  it('keeps the dialog open and shows the server message when create fails', async () => {
    const { w } = await open({
      postReply: [json({ code: 'branch_exists', message: 'taken' }, 409)],
    })
    w.findComponent(PynBranchesPage).vm.$emit('newBranch')
    dialog(w).vm.$emit('create', { name: 'topic', from: 'main' })
    await flushPromises()
    expect(dialog(w).props('open')).toBe(true)
    expect(dialog(w).props('error')).toBeTruthy()
  })

  it('renames through PATCH with the new name', async () => {
    const { w, calls, reloadBranches } = await open()
    const page = w.findComponent(PynBranchesPage)
    expect(page.props('canRename')).toBe(true)
    page.vm.$emit('rename', 'feature/x', 'feature/y')
    await flushPromises()
    const patch = calls.find((c) => c.method === 'PATCH')!
    expect(patch.url).toBe('/v1/repos/acme/game/branches/feature%2Fx')
    expect(JSON.parse(patch.body!)).toEqual({ name: 'feature/y' })
    expect(reloadBranches).toHaveBeenCalled()
  })

  it('deletes through the dialog', async () => {
    const { w, calls } = await open()
    w.findComponent(PynBranchesPage).vm.$emit('delete', 'feature/x')
    await flushPromises()
    expect(dialog(w).props('mode')).toBe('delete')
    expect(dialog(w).props('name')).toBe('feature/x')
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)
    dialog(w).vm.$emit('delete', { name: 'feature/x', force: false })
    await flushPromises()
    const del = calls.find((c) => c.method === 'DELETE')!
    expect(del.url).toBe('/v1/repos/acme/game/branches/feature%2Fx')
    expect(dialog(w).props('open')).toBe(false)
  })

  it('asks for the force step when the branch is not merged, then deletes with force', async () => {
    const { w, calls } = await open({
      deleteReply: [
        new Response(JSON.stringify({ code: 'branch_not_merged', message: 'x' }), { status: 409 }),
        new Response(null, { status: 204 }),
      ],
    })
    w.findComponent(PynBranchesPage).vm.$emit('delete', 'feature/x')
    dialog(w).vm.$emit('delete', { name: 'feature/x', force: false })
    await flushPromises()
    expect(dialog(w).props('open')).toBe(true)
    expect(dialog(w).props('unmerged')).toBe(true)
    expect(dialog(w).props('error')).toBeUndefined()
    dialog(w).vm.$emit('delete', { name: 'feature/x', force: true })
    await flushPromises()
    const dels = calls.filter((c) => c.method === 'DELETE')
    expect(dels).toHaveLength(2)
    expect(dels[1].url).toContain('force=true')
    expect(dialog(w).props('open')).toBe(false)
  })
})
