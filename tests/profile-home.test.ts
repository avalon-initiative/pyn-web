import {
  PynOrgHome,
  PynProfileLayout,
  PynReadme,
  PynRepoList,
} from '@avalon-initiative/pyn-common-ui'
import type { RepoInfo } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { routeLocationKey } from 'vue-router'
import { orgKey, sessionKey } from '../src/state/context.state'
import { loadProfileReadme, peopleOf, profileRepo } from '../src/state/profile-readme.state'
import OwnerView from '../src/views/OwnerView.vue'

const repo = (owner: string, name: string): RepoInfo => ({
  id: `${owner}/${name}`,
  owner,
  name,
  owner_id: owner,
  visibility: 'public',
  lease_hours: 24,
  created_at: '2026-01-02T03:04:05Z',
})
const profile = {
  id: 'u1',
  user: 'ada',
  created_at: '2026-01-02T03:04:05Z',
  profile: {},
  repositories: [repo('ada', 'ada'), repo('ada', 'engine')],
  repository_count: 2,
  organizations: [],
}
const starred = [{ starred_at: '2026-02-01T00:00:00Z', repo: repo('bob', 'lib') }]

function stub(urls: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = url.split('?')[0]
      if (path in urls) return new Response(JSON.stringify(urls[path]))
      if (path.endsWith('/content')) return new Response('# Hello')
      return new Response('{"code":"not_found","message":"x"}', { status: 404 })
    }),
  )
}

const view = (self: string, route: string, org: unknown = null, name = 'ada') =>
  mount(OwnerView, {
    global: {
      provide: {
        [routeLocationKey as symbol]: { name: route },
        [sessionKey as symbol]: { user: ref(self) },
        [orgKey as symbol]: {
          name: computed(() => name),
          org: ref(org),
          frozen: ref(false),
          reload: async () => {},
        },
      },
    },
  })

afterEach(() => vi.unstubAllGlobals())

describe('profile tabs', () => {
  const urls = {
    '/v1/users/ada': profile,
    '/v1/users/ada/starred': starred,
    '/v1/repos/ada/ada/tree': { path: '', entries: [] },
  }

  it('passes the starred list and its count, and Usage on the own profile', async () => {
    stub(urls)
    const w = view('ada', 'owner-stars')
    await flushPromises()
    const layout = w.findComponent(PynProfileLayout)
    expect(layout.props()).toMatchObject({ current: 'stars', self: true, stars: 1 })
    expect(layout.props('starredRepos')?.map((r) => r.name)).toEqual(['lib'])
    expect(w.findAll('nav a').map((a) => a.attributes('href'))).toEqual([
      '/ada',
      '/ada/-/repositories',
      '/ada/-/stars',
      '/ada/-/usage',
    ])
  })

  it('hides the Stars tab when the list cannot be read and Usage for others', async () => {
    stub({ '/v1/users/ada': profile })
    const w = view('bob', 'owner')
    await flushPromises()
    expect(w.findComponent(PynProfileLayout).props()).toMatchObject({ self: false })
    expect(w.findComponent(PynProfileLayout).props('stars')).toBeUndefined()
    expect(w.findAll('nav a')).toHaveLength(2)
  })
})

describe('profile README', () => {
  it('shows the README of the repository named like the account', async () => {
    stub({
      '/v1/users/ada': profile,
      '/v1/users/ada/starred': [],
      '/v1/repos/ada/ada/tree': {
        path: '',
        entries: [{ name: 'README.md', path: 'README.md', kind: 'file', last_change: { id: 3 } }],
      },
    })
    const w = view('bob', 'owner')
    await flushPromises()
    expect(w.findComponent(PynReadme).props()).toMatchObject({ owner: 'ada', name: 'ada' })
  })

  it('shows none without a profile repository', async () => {
    stub({
      '/v1/users/ada': { ...profile, repositories: [repo('ada', 'engine')] },
      '/v1/users/ada/starred': [],
    })
    const w = view('bob', 'owner')
    await flushPromises()
    expect(w.findComponent(PynReadme).exists()).toBe(false)
  })

  it('finds the profile repository only by the account name', () => {
    expect(profileRepo('ada', profile.repositories)?.name).toBe('ada')
    expect(profileRepo('bob', profile.repositories)).toBeNull()
    expect(profileRepo('ada', [repo('ada', 'engine')])).toBeNull()
  })

  it('returns null when reading fails', async () => {
    const read = { tree: vi.fn().mockRejectedValue(new Error('x')), content: vi.fn() }
    expect(await loadProfileReadme('ada', profile.repositories, read)).toBeNull()
  })
})

describe('organization home', () => {
  const studio = { id: 'o1', name: 'studio', created_at: '2026-01-01T00:00:00Z', role: 'member' }
  const urls = {
    '/v1/repos': [repo('studio', 'game')],
    '/v1/orgs/studio/members': [
      { user: 'ada', role: 'owner', identity: { user: 'ada', display_name: 'Ada' } },
      { user: 'bob', role: 'member' },
    ],
  }

  it('shows the people to a member, with the link to all of them', async () => {
    stub(urls)
    const w = view('ada', 'owner', studio, 'studio')
    await flushPromises()
    const home = w.findComponent(PynOrgHome)
    expect(home.props('people')?.map((p) => p.identity.user)).toEqual(['ada', 'bob'])
    expect(home.props('peopleHref')).toBe('/studio/-/members')
  })

  it('shows no people link to a visitor', async () => {
    stub(urls)
    const w = view('ada', 'owner', { ...studio, role: null }, 'studio')
    await flushPromises()
    expect(w.findComponent(PynOrgHome).props('peopleHref')).toBeUndefined()
    expect(w.findComponent(PynOrgHome).props('people')).toEqual([])
  })

  it('lists the repositories on the Repositories tab', async () => {
    stub(urls)
    const w = view('ada', 'owner-repositories', studio, 'studio')
    await flushPromises()
    expect(w.findComponent(PynOrgHome).exists()).toBe(false)
    expect(w.findComponent(PynRepoList).props('boxed')).toBe(true)
  })

  it('offers New repository to an owner on the overview and the Repositories tab', async () => {
    stub(urls)
    const owner = { ...studio, role: 'owner' }
    for (const route of ['owner', 'owner-repositories']) {
      const w = view('ada', route, owner, 'studio')
      await flushPromises()
      const link = w.findAll('a').filter((a) => a.text() === 'New repository')
      expect(link.map((a) => a.attributes('href'))).toEqual(['/_/new?owner=studio'])
    }
  })

  it('offers no New repository to a member or a visitor', async () => {
    stub(urls)
    for (const role of ['member', null]) {
      const w = view('ada', 'owner', { ...studio, role }, 'studio')
      await flushPromises()
      expect(w.text()).not.toContain('New repository')
    }
  })

  it('keeps the member list a bare name when a member has no identity', () => {
    expect(peopleOf([{ user: 'bob', role: 'member' }])).toEqual([{ identity: { user: 'bob' } }])
  })
})
