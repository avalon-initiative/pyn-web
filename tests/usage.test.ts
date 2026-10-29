import {
  PynOwnerUsage,
  PynStorageCapForm,
  PynUsageBreakdown,
} from '@avalon-initiative/pyn-common-ui'
import type { OwnerUsage, RepoUsage, RepoUsageBreakdown } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { routerKey } from 'vue-router'
import { ApiError, describeError } from '../src/api/client'
import { getOwnerUsage, getRepoBreakdown, getRepoUsage, setRepoStorageCap } from '../src/api/usage'
import { orgKey, repoKey, sessionKey } from '../src/state/context.state'
import { canSeeStorage } from '../src/state/repo-access.state'
import { routes } from '../src/router'
import OwnerUsageView from '../src/views/OwnerUsageView.vue'
import RepoSettingsView from '../src/views/RepoSettingsView.vue'

const row = (name: string, bytes: number, cap: number | null = null): RepoUsage => ({
  repository: `acme/${name}`,
  repo_id: `id-${name}`,
  stored_bytes: bytes,
  files: 3,
  revisions: 4,
  storage_cap: cap,
})

const ownerUsage: OwnerUsage = {
  owner: 'acme',
  owner_id: 'o1',
  limits: {
    owner_id: 'o1',
    kind: 'user',
    effective: { repositories: null, members: null, storage_bytes: 1000 },
    own: { repositories: null, members: null, storage_bytes: null },
  },
  usage: { repositories: 2, members: null, stored_bytes: 600 },
  repositories: [row('big', 500, 800), row('small', 100)],
}

const breakdown: RepoUsageBreakdown = {
  repository: 'acme/big',
  repo_id: 'id-big',
  stored_bytes: 500,
  storage_cap: 800,
  folders: [{ folder: 'art', stored_bytes: 400, files: 2 }],
  largest_paths: [{ path: 'art/hero.psd', stored_bytes: 300, revisions: 2 }],
}

function stubServer(calls: string[], bodies: unknown[] = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`)
      if (init?.body) bodies.push(JSON.parse(String(init.body)))
      if (url.endsWith('/usage/breakdown')) return new Response(JSON.stringify(breakdown))
      if (url.endsWith('/storage-cap')) return new Response(JSON.stringify({ storage_bytes: 7 }))
      if (url.startsWith('/v1/owners/')) return new Response(JSON.stringify(ownerUsage))
      return new Response(JSON.stringify(ownerUsage.repositories[0]))
    }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('usage API wrappers', () => {
  it('uses the documented paths and bodies', async () => {
    const calls: string[] = []
    const bodies: unknown[] = []
    stubServer(calls, bodies)
    await getOwnerUsage('acme')
    await getRepoUsage({ owner: 'acme', name: 'big' })
    await getRepoBreakdown({ owner: 'acme', name: 'big' })
    await setRepoStorageCap({ owner: 'acme', name: 'big' }, { storage_bytes: null })
    expect(calls).toEqual([
      'GET /v1/owners/acme/usage',
      'GET /v1/repos/acme/big/usage',
      'GET /v1/repos/acme/big/usage/breakdown',
      'PUT /v1/repos/acme/big/storage-cap',
    ])
    expect(bodies).toEqual([{ storage_bytes: null }])
  })
})

describe('repo_storage_limit_reached', () => {
  it('is worded plainly', () => {
    const msg = describeError(new ApiError(409, 'repo_storage_limit_reached', 'server wording'))
    expect(msg).toContain('storage cap')
    expect(msg).toContain('raise')
  })
})

describe('routes', () => {
  it('declares the owner usage page next to the organization pages', () => {
    const owner = routes.find((r) => r.path === '/:owner')!
    expect(owner.children!.find((c) => c.name === 'owner-usage')!.path).toBe('-/usage')
  })
})

describe('OwnerUsageView', () => {
  const mountView = (push = vi.fn()) =>
    mount(OwnerUsageView, {
      global: {
        provide: {
          [routerKey as symbol]: { push },
          [orgKey as symbol]: {
            name: computed(() => 'acme'),
            org: ref(null),
            frozen: ref(false),
            reload: async () => {},
          },
        },
      },
    })

  it('renders the usage in the server order and opens a repository', async () => {
    stubServer([])
    const push = vi.fn()
    const w = mountView(push)
    await flushPromises()
    const meter = w.findComponent(PynOwnerUsage)
    expect(meter.props('usage').repositories.map((r: RepoUsage) => r.repository)).toEqual([
      'acme/big',
      'acme/small',
    ])
    meter.vm.$emit('open', ownerUsage.repositories[0])
    expect(push).toHaveBeenCalledWith('/acme/big')
  })

  it('shows the server refusal plainly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ code: 'not_org_owner', message: 'x' }, { status: 403 })),
    )
    const w = mountView()
    await flushPromises()
    expect(w.text()).toContain('Only an owner of the organization can do that.')
    expect(w.findComponent(PynOwnerUsage).exists()).toBe(false)
  })
})

describe('repository Storage section', () => {
  const mountSettings = (user: string, permissions: string[], frozen = false) => {
    const calls: string[] = []
    const bodies: unknown[] = []
    stubServer(calls, bodies)
    const w = mount(RepoSettingsView, {
      global: {
        stubs: { RepoPolicyView: true },
        provide: {
          [routerKey as symbol]: { replace: vi.fn(), push: vi.fn() },
          [sessionKey as symbol]: { user: ref(user), admin: ref(false), expire: vi.fn() },
          [repoKey as symbol]: {
            target: computed(() => ({ owner: 'acme', name: 'big' })),
            repo: ref({
              id: 'id-big',
              owner: 'acme',
              name: 'big',
              visibility: 'private',
              lease_hours: 8,
              max_locks_per_user: null,
              max_locks_set_by_policy: false,
              created_at: '2026-10-01T09:00:00Z',
            }),
            permissions: ref(permissions),
            org: ref(null),
            frozen: ref(frozen),
            reload: vi.fn(),
          },
        },
      },
    })
    return { w, calls, bodies }
  }

  it('gates the section by owner or manage_roles', () => {
    expect(canSeeStorage([], true)).toBe(true)
    expect(canSeeStorage(['read', 'manage_roles'], false)).toBe(true)
    expect(canSeeStorage(['read', 'edit_policy'], false)).toBe(false)
  })

  it('shows breakdown and cap to the owner and saves and clears the cap', async () => {
    const { w, calls, bodies } = mountSettings('acme', ['read', 'manage_roles'])
    await flushPromises()
    expect(calls).toContain('GET /v1/repos/acme/big/usage/breakdown')
    expect(w.findComponent(PynUsageBreakdown).exists()).toBe(true)
    const form = w.findComponent(PynStorageCapForm)
    expect(form.props('cap')).toBe(800)
    form.vm.$emit('save', { storage_bytes: 5 })
    await flushPromises()
    form.vm.$emit('clear')
    await flushPromises()
    expect(bodies).toEqual([{ storage_bytes: 5 }, { storage_bytes: null }])
    expect(calls.filter((c) => c === 'PUT /v1/repos/acme/big/storage-cap')).toHaveLength(2)
  })

  it('passes the frozen flag as readonly', async () => {
    const { w } = mountSettings('acme', ['read', 'manage_roles'], true)
    await flushPromises()
    expect(w.findComponent(PynStorageCapForm).props('readonly')).toBe(true)
  })

  it('hides the breakdown from an owner without manage_roles', async () => {
    const { w, calls } = mountSettings('acme', ['read'])
    await flushPromises()
    expect(calls).not.toContain('GET /v1/repos/acme/big/usage/breakdown')
    expect(w.findComponent(PynUsageBreakdown).exists()).toBe(false)
    expect(w.findComponent(PynStorageCapForm).exists()).toBe(true)
  })

  it('shows only the breakdown to a repository admin who is not the owner', async () => {
    const { w } = mountSettings('bob', ['read', 'edit_policy', 'manage_roles'])
    await flushPromises()
    expect(w.findComponent(PynUsageBreakdown).exists()).toBe(true)
    expect(w.findComponent(PynStorageCapForm).exists()).toBe(false)
  })

  it('shows no section to someone who is neither', async () => {
    const { w, calls } = mountSettings('bob', ['read', 'edit_policy'])
    await flushPromises()
    expect(calls).toEqual([])
    expect(w.findComponent(PynUsageBreakdown).exists()).toBe(false)
  })
})
