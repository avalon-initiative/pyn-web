import { PynBranchBar, PynBranchCompare, PynBranchPicker } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { repo as repoInfo, rootListing, summary } from './fixtures/landing-data'

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const branch = (name: string, isDefault = false, updated_at?: string) => ({
  name,
  commit: 'a'.repeat(40),
  default: isDefault,
  created_at: '2026-10-01T09:00:00Z',
  created_by: 'bob',
  updated_at,
})

const repo = { ...repoInfo, owner: 'acme', name: 'game' }

const comparison = (over: Record<string, unknown> = {}) => ({
  base: 'main',
  head: 'feature',
  base_commit: 'b'.repeat(40),
  head_commit: 'a'.repeat(40),
  merge_base: 'b'.repeat(40),
  status: 'ahead',
  ahead: 2,
  behind: 0,
  counts_capped: false,
  max_commits: 1000,
  max_changes: 200,
  truncated: false,
  changes: [
    { path: 'src/new.txt', kind: 'added' },
    { path: 'src/old.txt', kind: 'modified' },
    { path: 'src/gone.txt', kind: 'deleted' },
  ],
  ...over,
})

function stubServer(calls: string[], compare: () => Promise<Response>) {
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
        return json([branch('main', true, '2026-10-02T09:00:00Z'), branch('feature')])
      if (path === '/v1/repos/acme/game/compare') return compare()
      if (path === '/v1/repos/acme/game/tree') return json(rootListing)
      if (path === '/v1/repos/acme/game/summary') return json(summary)
      if (path === '/v1/orgs/acme') return json({ code: 'org_not_found' }, 404)
      if (path.startsWith('/v1/owners/')) return json({ frozen: false })
      return json({ code: 'not_found', message: 'x' }, 404)
    }),
  )
}

const mounted: VueWrapper[] = []

async function open(path: string, compare: () => Promise<Response> = () => json(comparison())) {
  const calls: string[] = []
  stubServer(calls, compare)
  const router = makeRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const { default: App } = await import('../src/App.vue')
  const w = mount(App, { global: { plugins: [router] } })
  mounted.push(w)
  await flushPromises()
  await flushPromises()
  return { w, router, calls }
}

const compares = (calls: string[]) =>
  calls.filter((c) => c.startsWith('/v1/repos/acme/game/compare'))
const sentence = (w: { find: (s: string) => { text: () => string } }) => w.find('p').text()

afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  vi.unstubAllGlobals()
})

describe('branch picker', () => {
  it('passes each branch its last update time', async () => {
    const { w } = await open('/acme/game')
    expect(w.findComponent(PynBranchPicker).props('branches')).toEqual([
      { name: 'main', isDefault: true, updatedAt: '2026-10-02T09:00:00Z' },
      { name: 'feature', isDefault: false, updatedAt: undefined },
    ])
  })
})

describe('branch comparison', () => {
  it('requests head=<branch> and shows the ahead sentence', async () => {
    const { w, calls } = await open('/acme/game?branch=feature')
    expect(compares(calls)).toEqual(['/v1/repos/acme/game/compare?head=feature'])
    const c = w.findComponent(PynBranchCompare)
    expect(c.props()).toMatchObject({ base: 'main', head: 'feature', status: 'ahead', ahead: 2 })
    expect(c.text()).toContain('2 commits ahead of main')
  })

  it.each([
    ['behind', { status: 'behind', ahead: 0, behind: 3 }, '3 commits behind main'],
    ['diverged', { status: 'diverged', ahead: 1, behind: 4 }, '1 commit ahead, 4 behind main'],
    [
      'identical',
      { status: 'identical', ahead: 0, behind: 0, changes: [] },
      'Up to date with main',
    ],
  ])('shows the %s sentence', async (_n, over, text) => {
    const { w } = await open('/acme/game?branch=feature', () => json(comparison(over)))
    expect(sentence(w.findComponent(PynBranchCompare))).toBe(text)
  })

  it('passes capped counts and truncation through', async () => {
    const { w } = await open('/acme/game?branch=feature', () =>
      json(
        comparison({
          status: 'diverged',
          ahead: 1000,
          behind: 1000,
          counts_capped: true,
          truncated: true,
        }),
      ),
    )
    const c = w.findComponent(PynBranchCompare)
    expect(c.props()).toMatchObject({ countsCapped: true, maxCommits: 1000, truncated: true })
    expect(c.text()).toContain('1000+ commits ahead, 1000+ behind main')
  })

  it('shows an error and still renders the page when the comparison fails', async () => {
    const { w } = await open('/acme/game?branch=feature', () =>
      json({ code: 'invalid_request', message: 'history too long' }, 400),
    )
    expect(w.findComponent(PynBranchCompare).props('error')).toContain('history too long')
    expect(w.findComponent(PynBranchBar).exists()).toBe(true)
  })

  it('opens an added or modified path on the branch', async () => {
    const { w, router } = await open('/acme/game?branch=feature')
    w.findComponent(PynBranchCompare).vm.$emit('select', 'src/new.txt')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/acme/game/blob/src/new.txt')
    expect(router.currentRoute.value.query).toEqual({ branch: 'feature' })
    w.findComponent(PynBranchCompare).vm.$emit('select', 'src/old.txt')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ branch: 'feature' })
  })

  it('opens a deleted path on the default branch', async () => {
    const { w, router } = await open('/acme/game?branch=feature')
    w.findComponent(PynBranchCompare).vm.$emit('select', 'src/gone.txt')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/acme/game/blob/src/gone.txt')
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('makes no request on the default branch, and none for an unknown branch', async () => {
    const main = await open('/acme/game')
    expect(compares(main.calls)).toHaveLength(0)
    expect(main.w.findComponent(PynBranchCompare).exists()).toBe(false)
    const explicit = await open('/acme/game?branch=main')
    expect(compares(explicit.calls)).toHaveLength(0)
    const gone = await open('/acme/game?branch=gone')
    expect(compares(gone.calls)).toHaveLength(0)
    expect(gone.w.text()).toContain('no branch named gone')
  })

  it('refetches on a branch change and on focus, not on a route change', async () => {
    const { router, calls } = await open('/acme/game?branch=feature')
    await router.push('/acme/game/history?branch=feature')
    await flushPromises()
    await router.push('/acme/game/blob/a.txt?branch=feature')
    await flushPromises()
    expect(compares(calls)).toHaveLength(1)
    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(compares(calls)).toHaveLength(2)
    await router.push('/acme/game')
    await flushPromises()
    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(compares(calls)).toHaveLength(2)
  })
})

describe('branch summary', () => {
  const summaries = (calls: string[]) =>
    calls.filter((c) => c.startsWith('/v1/repos/acme/game/summary'))

  it('carries the branch on a branch and shows it in the bar', async () => {
    const { w, calls } = await open('/acme/game?branch=feature')
    expect(summaries(calls).every((c) => c.includes('branch=feature'))).toBe(true)
    expect(w.findComponent(PynBranchBar).props('branch')).toBe('feature')
  })

  it('omits the branch on the default branch', async () => {
    const { calls } = await open('/acme/game')
    expect(summaries(calls).length).toBeGreaterThan(0)
    expect(summaries(calls).some((c) => c.includes('branch='))).toBe(false)
  })
})
