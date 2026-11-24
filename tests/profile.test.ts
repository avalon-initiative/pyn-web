import { PynProfileHeader, PynProfileLayout, PynRepoList } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { routeLocationKey } from 'vue-router'
import { getProfile } from '../src/api/profile'
import { orgKey, sessionKey } from '../src/state/context.state'
import OwnerView from '../src/views/OwnerView.vue'

const profile = {
  id: 'u1',
  user: 'ada',
  created_at: '2026-01-02T03:04:05Z',
  profile: {
    display_name: 'Ada Lovelace',
    avatar_url: '/v1/users/ada/avatar?v=3',
    bio: 'Engines',
    location: 'London',
    company: 'Analytical',
    links: ['https://example.com'],
  },
  repositories: [
    { id: 'r1', owner: 'ada', name: 'engine', public: true, created_at: '2026-01-02T03:04:05Z' },
    { id: 'r2', owner: 'ada', name: 'notes', public: true, created_at: '2026-01-02T03:04:05Z' },
  ],
  repository_count: 2,
  organizations: [{ id: 'o1', name: 'studio', created_at: '2026-01-01T00:00:00Z', role: 'member' }],
}

const calls: string[] = []

function stub() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url)
      if (url === '/v1/users/ada') return new Response(JSON.stringify(profile))
      return new Response(JSON.stringify(profile.repositories))
    }),
  )
}

const mountView = (self: string, org: unknown = null, push = vi.fn()) =>
  mount(OwnerView, {
    global: {
      provide: {
        [routeLocationKey as symbol]: { name: 'owner' },
        [sessionKey as symbol]: { user: ref(self) },
        [orgKey as symbol]: {
          name: computed(() => 'ada'),
          org: ref(org),
          frozen: ref(false),
          reload: async () => {},
        },
      },
      mocks: { $router: { push } },
    },
  })

afterEach(() => {
  vi.unstubAllGlobals()
  calls.length = 0
})

describe('profile API', () => {
  it('reads the public profile route', async () => {
    stub()
    expect((await getProfile('ada')).user).toBe('ada')
    expect(calls).toEqual(['/v1/users/ada'])
  })
})

describe('OwnerView on a user', () => {
  it('wires the profile into the header, repositories and organizations', async () => {
    stub()
    const w = mountView('bob')
    await flushPromises()
    expect(w.findComponent(PynProfileHeader).props()).toMatchObject({
      username: 'ada',
      displayName: 'Ada Lovelace',
      avatarUrl: '/v1/users/ada/avatar?v=3',
      bio: 'Engines',
      location: 'London',
      company: 'Analytical',
      links: ['https://example.com'],
      createdAt: '2026-01-02T03:04:05Z',
    })
    const layout = w.findComponent(PynProfileLayout)
    expect(layout.props('repos')).toHaveLength(2)
    expect(layout.props('orgs')).toHaveLength(1)
    expect(layout.props('activityEntries')).toBeUndefined()
    expect(w.text()).not.toContain('Edit profile')
  })

  it('offers account settings on the own profile', async () => {
    stub()
    const w = mountView('ada')
    await flushPromises()
    expect(w.text()).toContain('Edit profile')
  })
})

describe('OwnerView on an organization', () => {
  it('keeps the plain repository list', async () => {
    stub()
    const w = mountView('bob', { id: 'o', name: 'ada', created_at: '' })
    await flushPromises()
    expect(calls).toEqual(['/v1/repos?owner=ada'])
    expect(w.findComponent(PynRepoList).exists()).toBe(true)
    expect(w.findComponent(PynProfileLayout).exists()).toBe(false)
  })
})
