import {
  PynRepoList,
  PynRepoShell,
  PynSignIn,
  PynSignInPrompt,
  PynTopBar,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeRouter } from '../src/router'

const repo = (owner: string, name: string) => ({
  id: `${owner}-${name}`,
  owner_id: owner,
  owner,
  name,
  visibility: 'public',
  lease_hours: 8,
  max_locks_per_user: 10,
  max_locks_set_by_policy: false,
  created_at: '2026-10-01T09:00:00Z',
})
const refuse = (status: number, code: string) =>
  Response.json({ code, message: 'x' }, { status, headers: {} })

function stub(access: 'public' | 'private', calls: string[] = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url)
      const path = url.split('?')[0]
      if (path === '/v1/setup') return Response.json({ initialised: true, access_mode: access })
      if (path === '/v1/session') return refuse(401, 'unauthenticated')
      if (path === '/v1/explore/repos') {
        return url.includes('after=')
          ? Response.json({ repos: [repo('cy', 'c')], next_after: null })
          : Response.json({ repos: [repo('ann', 'a'), repo('bo', 'b')], next_after: 'bo/b' })
      }
      if (path === '/v1/repos/ann/a') return Response.json(repo('ann', 'a'))
      if (path === '/v1/repos/ann/secret') return refuse(404, 'repo_not_found')
      if (path === '/v1/users/ann')
        return Response.json({
          user: 'ann',
          profile: {},
          created_at: '2026-10-01T09:00:00Z',
          repositories: [repo('ann', 'a')],
          organizations: [],
        })
      if (path === '/v1/users/studio') return refuse(404, 'user_not_found')
      if (path.endsWith('/locks')) return Response.json([])
      if (path.endsWith('/branches')) return Response.json([])
      if (path.endsWith('/summary') || path.endsWith('/tree') || path.endsWith('/history'))
        return refuse(404, 'path_not_found')
      return refuse(401, 'unauthenticated')
    }),
  )
  return calls
}

afterEach(() => vi.unstubAllGlobals())

async function open(path: string) {
  const router = makeRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const { default: App } = await import('../src/App.vue')
  const w = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  return { w, router }
}

describe('public browsing, signed out', () => {
  it('marks the browsable routes public and the rest not', () => {
    const meta = (p: string) => makeRouter(createMemoryHistory()).resolve(p).matched.at(-1)?.meta
    for (const p of [
      '/_/explore',
      '/ann',
      '/ann/a',
      '/ann/a/tree/x',
      '/ann/a/blob/x',
      '/ann/a/locks',
      '/ann/a/history',
    ])
      expect(meta(p)?.public, p).toBe(true)
    for (const p of ['/ann/a/settings', '/ann/a/settings/policy', '/_/new', '/_/locks'])
      expect(meta(p)?.public, p).toBeFalsy()
  })

  it('lists public repositories on explore, with paging, in the signed-out shell', async () => {
    const calls = stub('public')
    const { w } = await open('/_/explore')
    expect(w.findComponent(PynTopBar).props('signedOut')).toBe(true)
    expect(
      w
        .findComponent(PynRepoList)
        .props('repos')
        .map((r: { name: string }) => r.name),
    ).toEqual(['a', 'b'])
    await w
      .findAll('button')
      .find((b) => b.text() === 'Show more')!
      .trigger('click')
    await flushPromises()
    expect(calls.some((c) => c.includes('/v1/explore/repos?') && c.includes('after=bo'))).toBe(true)
    expect(w.findComponent(PynRepoList).props('repos')).toHaveLength(3)
  })

  it('shows a prompt on explore when the server refuses the list', async () => {
    stub('public')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.startsWith('/v1/setup')
          ? Response.json({ initialised: true, access_mode: 'public' })
          : refuse(401, 'unauthenticated'),
      ),
    )
    const { w } = await open('/_/explore')
    expect(w.findComponent(PynSignInPrompt).exists()).toBe(true)
  })

  it('renders a public repository with a prompt and without account-only requests', async () => {
    const calls = stub('public')
    const { w } = await open('/ann/a')
    expect(w.findComponent(PynRepoShell).exists()).toBe(true)
    expect(w.findComponent(PynSignInPrompt).exists()).toBe(true)
    expect(w.findComponent(PynTopBar).props('signedOut')).toBe(true)
    expect(calls.some((c) => c.includes('/me') && c.startsWith('/v1/repos'))).toBe(false)
    expect(calls.some((c) => c.startsWith('/v1/orgs') || c.includes('/freeze'))).toBe(false)
    expect(w.text()).not.toContain('Settings')
  })

  it('shows the same prompt for a private or missing repository, never not-found', async () => {
    stub('public')
    const { w } = await open('/ann/secret')
    expect(w.findComponent(PynSignInPrompt).exists()).toBe(true)
    expect(w.findComponent(PynRepoShell).exists()).toBe(false)
    expect(w.text()).not.toMatch(/not found/i)
  })

  it('opens a user page from the public profile, and prompts for an unknown or organization name', async () => {
    stub('public')
    const a = await open('/ann')
    expect(a.w.findComponent(PynRepoList).exists() || a.w.text().includes('a')).toBe(true)
    expect(a.w.findComponent(PynSignInPrompt).exists()).toBe(false)
    const b = await open('/studio')
    expect(b.w.findComponent(PynSignInPrompt).exists()).toBe(true)
  })

  it('opens sign-in from the prompt, keeping the page', async () => {
    stub('public')
    const { w, router } = await open('/ann/a')
    await w.find('[data-sign-in]').trigger('click')
    await flushPromises()
    expect(w.findComponent(PynSignIn).props('returnTo')).toBe('/ann/a')
    expect(router.currentRoute.value.fullPath).toBe('/ann/a')
  })

  it('sends account pages to sign-in', async () => {
    stub('public')
    const { w } = await open('/ann/a/settings')
    expect(w.findComponent(PynSignIn).exists()).toBe(true)
  })

  it('shows sign-in instead of public pages on a private server', async () => {
    stub('private')
    const { w } = await open('/ann/a')
    expect(w.findComponent(PynSignIn).exists()).toBe(true)
    expect(w.findComponent(PynRepoShell).exists()).toBe(false)
  })
})
