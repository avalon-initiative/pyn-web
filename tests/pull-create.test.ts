import {
  PynPullRequestForm,
  PynPullRequestList,
  PynRepoShell,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { diffCounts } from '../src/state/pull.state'
import { repo as repoInfo, rootListing, summary } from './fixtures/landing-data'

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))
const repo = { ...repoInfo, owner: 'acme', name: 'game' }
const branch = (name: string, isDefault = false) => ({
  name,
  commit: 'a'.repeat(40),
  default: isDefault,
  created_at: '2026-10-01T09:00:00Z',
  created_by: 'bob',
})
const pull = (number: number, extra: object = {}) => ({
  number,
  title: `Change ${number}`,
  state: 'open',
  draft: false,
  author: { user: 'bob' },
  base: 'main',
  head: 'feature',
  opened_at: '2026-11-01T10:00:00Z',
  comments: 0,
  ...extra,
})
const detail = (number: number) => ({
  ...pull(number),
  body: '',
  commits: 1,
  changed_files: 1,
  additions: 1,
  deletions: 0,
  locks: [],
  participants: [],
  base_commit: 'b'.repeat(40),
  head_commit: 'h'.repeat(40),
})
const diffFile = (path: string, additions: number, deletions: number) => ({
  path,
  status: 'modified',
  additions,
  deletions,
  binary: false,
  too_large: false,
  mode: 'shared',
  hunks: [],
})
const diff = {
  base: 'main',
  base_commit: 'b'.repeat(40),
  head: 'feature',
  head_commit: 'h'.repeat(40),
  from_commit: 'b'.repeat(40),
  files: [diffFile('a.txt', 3, 1), diffFile('b.txt', 2, 0)],
  truncated: false,
}

type Call = { url: string; method: string; body?: unknown }
type Reply = (path: string, method: string, url: string) => Promise<Response> | undefined

function stubServer(calls: Call[], reply: Reply, permissions = ['read', 'checkin']) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      const [path] = url.split('?') as [string]
      const own = reply(path, method, url)
      if (own) return own
      if (path === '/v1/session')
        return json({ user: 'bob', csrf_token: 't', expires_at: '2030-01-01T00:00:00Z' })
      if (path === '/v1/setup') return json({ initialised: true })
      if (path === '/v1/me') return json({ user: 'bob', admin: false })
      if (path === '/v1/server') return json({ version: '0', revision: 'x' })
      if (path === '/v1/repos/acme/game') return json(repo)
      if (path === '/v1/repos/acme/game/me') return json({ permissions })
      if (path === '/v1/repos/acme/game/branches')
        return json([branch('main', true), branch('feature')])
      if (path === '/v1/repos/acme/game/tags') return json([])
      if (path === '/v1/repos/acme/game/locks') return json([])
      if (path === '/v1/repos/acme/game/pulls' && method === 'GET')
        return json({ pulls: [pull(1), pull(2)], next_before: null })
      if (path === '/v1/repos/acme/game/diff') return json(diff)
      if (path === '/v1/repos/acme/game/tree') return json(rootListing)
      if (path === '/v1/repos/acme/game/summary') return json(summary)
      if (path === '/v1/orgs/acme') return json({ code: 'org_not_found' }, 404)
      if (path.startsWith('/v1/owners/')) return json({ frozen: false })
      return json({ code: 'not_found', message: 'x' }, 404)
    }),
  )
}

async function openApp(path: string, reply: Reply = () => undefined, permissions?: string[]) {
  const calls: Call[] = []
  stubServer(calls, reply, permissions)
  const router = makeRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const { default: App } = await import('../src/App.vue')
  const w = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  await flushPromises()
  return { w, router, calls }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('open pull request count', () => {
  it('reads one page of open pull requests for the tab', async () => {
    const { w, calls } = await openApp('/acme/game')
    expect(w.findComponent(PynRepoShell).props('pullCount')).toBe(2)
    expect(
      calls.filter((c) => c.url.startsWith('/v1/repos/acme/game/pulls')).map((c) => c.url),
    ).toEqual(['/v1/repos/acme/game/pulls?state=open&limit=100'])
  })

  it('counts a comparison', () => {
    expect(diffCounts(diff as never)).toEqual({
      files: 2,
      additions: 5,
      deletions: 1,
      truncated: false,
    })
  })
})

describe('new pull request', () => {
  it('links the list to the create page for a checkin only', async () => {
    const { w } = await openApp('/acme/game/pulls')
    expect(w.findComponent(PynPullRequestList).props('newHref')).toBe('/acme/game/pulls/new')
    const reader = await openApp('/acme/game/pulls', undefined, ['read'])
    expect(reader.w.findComponent(PynPullRequestList).props('newHref')).toBeUndefined()
  })

  it('compares the branches and opens the new pull request', async () => {
    const { w, router, calls } = await openApp('/acme/game/pulls/new?head=feature', (p, m) =>
      p === '/v1/repos/acme/game/pulls' && m === 'POST'
        ? json(detail(9))
        : p === '/v1/repos/acme/game/pulls/9'
          ? json(detail(9))
          : undefined,
    )
    const form = w.findComponent(PynPullRequestForm)
    expect(form.props('branches').map((b: { name: string }) => b.name)).toEqual(['main', 'feature'])
    expect(form.props('head')).toBe('feature')
    expect(form.props('cancelHref')).toBe('/acme/game/pulls')
    expect(
      calls.some((c) => c.url === '/v1/repos/acme/game/diff?head=feature&merge_base=true'),
    ).toBe(true)
    expect(form.text()).toContain('2 files changed')
    form.vm.$emit('submit', { title: 'T', body: 'B', draft: true, base: '', head: 'feature' })
    await flushPromises()
    const post = calls.find((c) => c.method === 'POST')!
    expect(post.url).toBe('/v1/repos/acme/game/pulls')
    expect(post.body).toEqual({ title: 'T', body: 'B', draft: true, head: 'feature' })
    expect(router.currentRoute.value.path).toBe('/acme/game/pulls/9')
  })

  it('links the open pull request the server says already exists', async () => {
    const { w, calls } = await openApp('/acme/game/pulls/new', (p, m, url) =>
      p === '/v1/repos/acme/game/pulls' && m === 'POST'
        ? json({ code: 'pull_request_exists', message: 'exists' }, 409)
        : url.includes('head=feature')
          ? json({ pulls: [pull(4)], next_before: null })
          : undefined,
    )
    w.findComponent(PynPullRequestForm).vm.$emit('submit', {
      title: 'T',
      body: '',
      draft: false,
      base: '',
      head: 'feature',
    })
    await flushPromises()
    expect(calls.at(-1)!.url).toBe(
      '/v1/repos/acme/game/pulls?state=open&head=feature&base=main&limit=1',
    )
    expect(w.text()).toContain('A pull request already exists')
    expect(w.find('a[href="/acme/game/pulls/4"]').exists()).toBe(true)
    expect(w.findComponent(PynPullRequestForm).props('error')).toBeUndefined()
  })

  it('shows another refusal on the form', async () => {
    const { w } = await openApp('/acme/game/pulls/new', (p, m) =>
      p === '/v1/repos/acme/game/pulls' && m === 'POST'
        ? json({ code: 'invalid_request', message: 'nothing to merge' }, 400)
        : undefined,
    )
    const form = w.findComponent(PynPullRequestForm)
    form.vm.$emit('submit', { title: 'T', body: '', draft: false, base: '', head: 'feature' })
    await flushPromises()
    expect(form.props('error')).toBeTruthy()
    expect(w.text()).not.toContain('A pull request already exists')
  })
})
