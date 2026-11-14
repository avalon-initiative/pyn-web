import { PynRepoSettings, PynRepoShell } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { repoKey, sessionKey } from '../src/state/context.state'
import RepoSettingsLayout from '../src/views/RepoSettingsLayout.vue'

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const repo = {
  id: 'r1',
  owner: 'acme',
  name: 'game',
  visibility: 'private',
  lease_hours: 8,
  max_locks_per_user: 10,
  max_locks_set_by_policy: false,
  created_at: '2026-10-01T09:00:00Z',
  role: 'admin',
}

function stubServer(permissions: string[], org: unknown = null) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/v1/session')
        return json({ user: 'bob', csrf_token: 't', expires_at: '2030-01-01T00:00:00Z' })
      if (url === '/v1/setup') return json({ initialised: true })
      if (url === '/v1/me') return json({ user: 'bob', admin: false })
      if (url === '/v1/server') return json({ version: '0', revision: 'x' })
      if (url === '/v1/repos/acme/game') return json(repo)
      if (url === '/v1/repos/acme/game/me') return json({ permissions })
      if (url === '/v1/orgs/acme') return org ? json(org) : json({ code: 'org_not_found' }, 404)
      if (url.startsWith('/v1/owners/')) return json({ frozen: false })
      return json({ code: 'not_found', message: 'x' }, 404)
    }),
  )
}

async function open(path: string, permissions = ['read', 'lock'], org: unknown = null) {
  stubServer(permissions, org)
  const router = makeRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const { default: App } = await import('../src/App.vue')
  const w = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  await flushPromises()
  return { w, router }
}

afterEach(() => vi.unstubAllGlobals())

describe('repository routes', () => {
  const resolve = (path: string) => makeRouter(createMemoryHistory()).resolve(path)

  it('marks the repository parent route bare and nothing else', () => {
    const bare = (p: string) => resolve(p).matched.some((r) => r.meta.bare)
    expect(bare('/acme/game')).toBe(true)
    expect(bare('/acme/game/settings/members')).toBe(true)
    expect(bare('/acme/game/blob/a.txt')).toBe(true)
    expect(bare('/')).toBe(false)
    expect(bare('/acme')).toBe(false)
    expect(bare('/_/locks')).toBe(false)
  })

  it('keeps files, tree, blob, locks and history', () => {
    expect(resolve('/acme/game').name).toBe('files')
    expect(resolve('/acme/game/tree/src').name).toBe('tree')
    expect(resolve('/acme/game/blob/a/b.txt').name).toBe('blob')
    expect(resolve('/acme/game/locks').name).toBe('locks')
    expect(resolve('/acme/game/history').name).toBe('history')
  })

  it.each(['members', 'roles', 'invites', 'audit'])('redirects /%s under settings', async (s) => {
    const router = makeRouter(createMemoryHistory())
    await router.push(`/acme/game/${s}?x=1`)
    expect(router.currentRoute.value.path).toBe(`/acme/game/settings/${s}`)
    expect(router.currentRoute.value.query).toEqual({ x: '1' })
    expect(router.currentRoute.value.params).toMatchObject({ owner: 'acme', name: 'game' })
  })

  it('preserves dotted repository names across a redirect', async () => {
    const router = makeRouter(createMemoryHistory())
    await router.push('/a/b.c/members')
    expect(router.currentRoute.value.path).toBe('/a/b.c/settings/members')
  })

  it.each([
    ['', 'settings'],
    ['/members', 'settings-members'],
    ['/roles', 'settings-roles'],
    ['/invites', 'settings-invites'],
    ['/policy', 'settings-policy'],
    ['/storage', 'settings-storage'],
    ['/audit', 'settings-audit'],
  ])('routes settings%s to %s', (suffix, name) => {
    expect(resolve(`/acme/game/settings${suffix}`).name).toBe(name)
  })
})

describe('shell on repository and dashboard routes', () => {
  it('hides the sidebar on a repository page and keeps the top bar', async () => {
    const { w } = await open('/acme/game')
    expect(w.find('header ~ aside').exists()).toBe(false)
    expect(w.find('[aria-label="Toggle navigation"]').exists()).toBe(false)
    expect(w.find('header').exists()).toBe(true)
  })

  it('shows the sidebar on dashboard routes', async () => {
    const { w } = await open('/')
    expect(w.find('header ~ aside').exists()).toBe(true)
  })

  it('shows the repository shell with its tab bar', async () => {
    const { w } = await open('/acme/game')
    const shell = w.findComponent(PynRepoShell)
    expect(shell.props('visibility')).toBe('private')
    expect(shell.props('ownerHref')).toBe('/acme')
    expect(shell.props('tabs')!.map((t: { label: string }) => t.label)).toEqual([
      'Code',
      'Locks',
      'History',
    ])
    expect(shell.text()).toContain('8h leases')
    expect(shell.text()).toContain('your role: admin')
  })

  it('marks an organization-owned repository', async () => {
    const org = { name: 'acme', role: 'member' }
    const { w } = await open('/acme/game', ['read'], org)
    expect(w.findComponent(PynRepoShell).props('ownerHref')).toBe('/acme')
    expect(w.find('[data-org]').exists()).toBe(true)
  })

  it('hides the tab bar and explains without read', async () => {
    const { w } = await open('/acme/game', [])
    expect(w.findComponent(PynRepoShell).props('tabs')).toBeUndefined()
    expect(w.text()).toContain('You have no role in this repository')
  })

  it.each([
    ['/acme/game', ''],
    ['/acme/game/tree/src', ''],
    ['/acme/game/blob/locks', ''],
    ['/acme/game/locks', 'locks'],
    ['/acme/game/history', 'history'],
    ['/acme/game/settings/policy', 'settings/policy'],
    ['/acme/game/settings/members', 'settings/members'],
  ])('maps %s to current "%s"', async (path, current) => {
    const { w } = await open(path, ['read', 'manage_users', 'edit_policy'])
    expect(w.findComponent(PynRepoShell).props('current')).toBe(current)
  })

  it('shows Settings only to those who can open it', async () => {
    const labels = async (permissions: string[]) =>
      (await open('/acme/game', permissions)).w
        .findComponent(PynRepoShell)
        .props('tabs')!
        .map((t: { label: string }) => t.label)
    expect(await labels(['read'])).not.toContain('Settings')
    expect(await labels(['read', 'edit_policy'])).toContain('Settings')
  })
})

describe('RepoSettingsLayout', () => {
  async function layout(path: string, user: string, permissions: string[], admin = false) {
    const router = makeRouter(createMemoryHistory())
    await router.push(path)
    await router.isReady()
    const w = mount(RepoSettingsLayout, {
      global: {
        plugins: [router],
        stubs: { RouterView: true },
        provide: {
          [sessionKey as symbol]: { user: ref(user), admin: ref(admin), expire: vi.fn() },
          [repoKey as symbol]: {
            target: computed(() => ({ owner: 'acme', name: 'game' })),
            repo: ref(repo),
            permissions: ref(permissions),
            org: ref(null),
            frozen: ref(false),
            reload: vi.fn(),
          },
        },
      },
    })
    await flushPromises()
    return { w, router }
  }
  const sections = (w: Awaited<ReturnType<typeof layout>>['w']) =>
    w
      .findComponent(PynRepoSettings)
      .props('items')
      .map((i: { section: string }) => i.section)

  it('lists every section for an owner with all permissions', async () => {
    const { w } = await layout('/acme/game/settings', 'acme', [
      'read',
      'manage_users',
      'manage_roles',
      'edit_policy',
      'view_audit',
    ])
    expect(sections(w)).toEqual([
      'settings',
      'members',
      'roles',
      'invites',
      'policy',
      'storage',
      'audit',
    ])
    expect(w.findComponent(PynRepoSettings).props('current')).toBe('settings')
  })

  it('takes current from the segment after settings/', async () => {
    const { w } = await layout('/acme/game/settings/members', 'acme', ['read', 'manage_users'])
    expect(w.findComponent(PynRepoSettings).props('current')).toBe('members')
  })

  it('lists only the permitted sections for a non-owner', async () => {
    const { w, router } = await layout('/acme/game/settings/audit', 'bob', ['read', 'view_audit'])
    expect(sections(w)).toEqual(['audit'])
    expect(router.currentRoute.value.path).toBe('/acme/game/settings/audit')
  })

  it('redirects a non-owner without General access to the first visible item', async () => {
    const { router } = await layout('/acme/game/settings', 'bob', [
      'read',
      'manage_users',
      'view_audit',
    ])
    expect(router.currentRoute.value.path).toBe('/acme/game/settings/members')
  })

  it('redirects a policy editor to the policy page', async () => {
    const { router } = await layout('/acme/game/settings', 'bob', ['read', 'edit_policy'])
    expect(router.currentRoute.value.path).toBe('/acme/game/settings/policy')
  })

  it('redirects to the repository root when the nav is empty', async () => {
    const { router } = await layout('/acme/game/settings', 'bob', ['read', 'lock'])
    expect(router.currentRoute.value.path).toBe('/acme/game')
  })

  it('does not redirect an owner away from General', async () => {
    const { router } = await layout('/acme/game/settings', 'acme', ['read'])
    expect(router.currentRoute.value.path).toBe('/acme/game/settings')
  })

  it('gives a server administrator the General and Storage pages', async () => {
    const { w } = await layout('/acme/game/settings/storage', 'ops', ['read'], true)
    expect(sections(w)).toContain('storage')
  })
})
