import { PynBranchPicker, PynViewSummary } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { fetchContent, fetchHistory, fetchTree } from '../src/api/repos'
import { makeRouter } from '../src/router'
import { repo as repoInfo, rootEntries, rootListing, summary } from './fixtures/landing-data'

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const branch = (name: string, isDefault = false) => ({
  name,
  commit: 'a'.repeat(40),
  default: isDefault,
  created_at: '2026-10-01T09:00:00Z',
  created_by: 'bob',
})

const repo = { ...repoInfo, owner: 'acme', name: 'game' }

function stubServer(calls: string[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      calls.push(url)
      const [path] = url.split('?')
      if (path === '/v1/session')
        return json({ user: 'bob', csrf_token: 't', expires_at: '2030-01-01T00:00:00Z' })
      if (path === '/v1/setup') return json({ initialised: true })
      if (path === '/v1/me') return json({ user: 'bob', admin: false })
      if (path === '/v1/server') return json({ version: '0', revision: 'x' })
      if (path === '/v1/repos/acme/game') return json(repo)
      if (path === '/v1/repos/acme/game/me') return json({ permissions: ['read', 'lock'] })
      if (path === '/v1/repos/acme/game/branches')
        return json([branch('main', true), branch('feature')])
      if (path === '/v1/repos/acme/game/tree')
        return json(
          url.includes('path=dir')
            ? {
                path: 'dir',
                entries: [{ ...rootEntries[3], name: 'pic.png', path: 'dir/pic.png' }],
              }
            : rootListing,
        )
      if (path === '/v1/repos/acme/game/summary') return json(summary)
      if (path === '/v1/repos/acme/game/history') return json({ revisions: [], next_cursor: null })
      if (path === '/v1/orgs/acme') return json({ code: 'org_not_found' }, 404)
      if (path.startsWith('/v1/owners/')) return json({ frozen: false })
      return json({ code: 'not_found', message: 'x' }, 404)
    }),
  )
}

async function open(path: string) {
  const calls: string[] = []
  stubServer(calls)
  const router = makeRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const { default: App } = await import('../src/App.vue')
  const w = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  await flushPromises()
  return { w, router, calls }
}

const ofPath = (calls: string[], p: string) => calls.filter((c) => c.split('?')[0] === p)

afterEach(() => vi.unstubAllGlobals())

describe('branch picker', () => {
  it('loads and lists the branches with the default as current', async () => {
    const { w, calls } = await open('/acme/game')
    const picker = w.findComponent(PynBranchPicker)
    expect(ofPath(calls, '/v1/repos/acme/game/branches')).toHaveLength(1)
    expect(picker.props('branches')).toEqual([
      { name: 'main', isDefault: true },
      { name: 'feature', isDefault: false },
    ])
    expect(picker.props('current')).toBe('main')
  })

  it('shows the header picker only where branches apply', async () => {
    const pickers = async (path: string) =>
      (await open(path)).w.findAllComponents(PynBranchPicker).length
    expect(await pickers('/acme/game/history')).toBe(1)
    expect(await pickers('/acme/game/blob/a.txt')).toBe(1)
    for (const tab of ['locks', 'branches', 'policy']) {
      expect([tab, await pickers(`/acme/game/${tab}`)]).toEqual([tab, 0])
    }
  })

  it('reads the default branch when the address names none', async () => {
    const { calls } = await open('/acme/game')
    const tree = ofPath(calls, '/v1/repos/acme/game/tree')
    expect(tree.length).toBeGreaterThan(0)
    expect(tree.every((u) => !u.includes('branch='))).toBe(true)
  })

  it('selecting a branch updates the address and refetches the tree', async () => {
    const { w, router, calls } = await open('/acme/game')
    w.findComponent(PynBranchPicker).vm.$emit('select', 'feature')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ branch: 'feature' })
    expect(ofPath(calls, '/v1/repos/acme/game/tree').pop()).toContain('branch=feature')
    expect(w.findComponent(PynBranchPicker).props('current')).toBe('feature')
    w.findComponent(PynBranchPicker).vm.$emit('select', 'main')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('opens a linked branch and reads it on every page', async () => {
    const { router, calls } = await open('/acme/game?branch=feature')
    expect(
      ofPath(calls, '/v1/repos/acme/game/tree').every((u) => u.includes('branch=feature')),
    ).toBe(true)
    await router.push('/acme/game/history?branch=feature')
    await flushPromises()
    expect(ofPath(calls, '/v1/repos/acme/game/history').pop()).toContain('branch=feature')
    await router.push('/acme/game/blob/a.txt?branch=feature')
    await flushPromises()
    expect(ofPath(calls, '/v1/repos/acme/game/tree').pop()).toContain('branch=feature')
  })

  it('shows a message and a way back for an unknown branch', async () => {
    const { w, calls } = await open('/acme/game?branch=gone')
    const note = w.findComponent(PynViewSummary)
    expect(note.text()).toContain('no branch named gone')
    expect(note.find('a').attributes('href')).toBe('/acme/game')
    expect(ofPath(calls, '/v1/repos/acme/game/tree')).toHaveLength(0)
  })

  it('leaves settings pages unaffected by a branch', async () => {
    const { router } = await open('/acme/game?branch=feature')
    await router.push('/acme/game/settings/policy')
    expect(router.currentRoute.value.query).toEqual({})
  })
})

const hrefs = (w: VueWrapper) => w.findAll('a').map((a) => a.attributes('href') ?? '')

describe('branch-aware links', () => {
  it('carry the chosen branch on tree rows, tabs and the history link', async () => {
    const { w } = await open('/acme/game?branch=feature')
    const links = hrefs(w)
    expect(links).toContain('/acme/game?branch=feature')
    expect(links).toContain('/acme/game/history?branch=feature')
    const rows = links.filter((h) => h.startsWith('/acme/game/blob/') || h.includes('/tree/'))
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((h) => h.includes('branch=feature'))).toBe(true)
  })

  it('carry no branch on the default branch', async () => {
    const { w } = await open('/acme/game')
    const links = hrefs(w).filter((h) => h.startsWith('/acme/game'))
    expect(links.length).toBeGreaterThan(0)
    expect(links.some((h) => h.includes('branch='))).toBe(false)
  })

  it('leave the Locks and other tabs without a branch', async () => {
    const { w } = await open('/acme/game?branch=feature')
    const others = hrefs(w).filter(
      (h) => h.startsWith('/acme/game/') && !/\/(history|blob|tree)(\/|\?|$)/.test(h),
    )
    expect(others.length).toBeGreaterThan(0)
    expect(others.some((h) => h.includes('branch='))).toBe(false)
  })

  it('keep the branch when the same path is clicked again', async () => {
    const { w, router } = await open('/acme/game?branch=feature')
    await w.find('a[href="/acme/game?branch=feature"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ branch: 'feature' })
  })
})

describe('branch-aware file page', () => {
  it('puts the branch on the breadcrumbs, history link and image address', async () => {
    const { w } = await open('/acme/game/blob/dir/pic.png?branch=feature')
    const links = hrefs(w)
    expect(links).toContain('/acme/game/tree/dir?branch=feature')
    expect(
      links.some((h) => h.startsWith('/acme/game/history') && h.includes('branch=feature')),
    ).toBe(true)
    expect(w.find('img[src*="/content"]').attributes('src')).toContain('branch=feature')
  })

  it('leaves them without a branch on the default branch', async () => {
    const { w } = await open('/acme/game/blob/dir/pic.png')
    expect(hrefs(w).some((h) => h.includes('branch='))).toBe(false)
    expect(w.find('img[src*="/content"]').attributes('src')).not.toContain('branch=')
  })
})

describe('branch-aware requests', () => {
  it('pass the branch to the tree, content and history reads, and omit it when absent', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        calls.push(url)
        return json({ path: '', entries: [], revisions: [], next_cursor: null })
      }),
    )
    const r = { owner: 'acme', name: 'game' }
    await fetchTree(r, 'src', 'feature')
    await fetchContent(r, 'a.txt', 100, undefined, 'feature')
    await fetchHistory(r, { branch: 'feature' })
    await fetchTree(r, 'src')
    await fetchContent(r, 'a.txt', 100)
    await fetchHistory(r)
    expect(calls.map((c) => c.includes('branch=feature'))).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
    ])
  })
})
