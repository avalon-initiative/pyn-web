import {
  PynAccountSettings,
  PynAdminLayout,
  PynOrgHeader,
  PynProfileHeader,
  PynRepoLanding,
  PynRepoShell,
  PynSettingsLayout,
  PynUserHeader,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { lockHolders, railBranches } from '../src/state/repo-rail.state'
import { repoKey, sessionKey } from '../src/state/context.state'
import AccountView from '../src/views/AccountView.vue'
import AdminView from '../src/views/AdminView.vue'
import RepoSettingsLayout from '../src/views/RepoSettingsLayout.vue'
import { repo as repoInfo, rootListing, summary } from './fixtures/landing-data'

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const branch = (name: string, updated: string, isDefault = false) => ({
  name,
  commit: 'a'.repeat(40),
  default: isDefault,
  created_at: '2026-10-01T09:00:00Z',
  created_by: 'bob',
  updated_at: updated,
})

const repo = { ...repoInfo, owner: 'acme', name: 'game', star_count: 0, starred: false }

interface Options {
  org?: unknown
  profile?: unknown
  locks?: unknown[] | null
  branches?: unknown[]
  compare?: unknown
  calls?: string[]
}

function stubServer(o: Options = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const [path] = url.split('?')
      o.calls?.push(path)
      if (path === '/v1/session')
        return json({ user: 'bob', csrf_token: 't', expires_at: '2030-01-01T00:00:00Z' })
      if (path === '/v1/setup') return json({ initialised: true })
      if (path === '/v1/me') return json({ user: 'bob', admin: true })
      if (path === '/v1/server') return json({ version: '0', revision: 'x' })
      if (path === '/v1/repos/acme/game') return json(repo)
      if (path === '/v1/repos/acme/game/me') return json({ permissions: ['read', 'lock'] })
      if (path === '/v1/repos/acme/game/branches')
        return json(
          o.branches ?? [
            branch('main', '2026-10-08T10:00:00Z', true),
            branch('feature', '2026-10-07T10:00:00Z'),
          ],
        )
      if (path === '/v1/repos/acme/game/locks')
        return o.locks === null ? json({ code: 'x' }, 500) : json(o.locks ?? summary.locks)
      if (path === '/v1/repos/acme/game/compare') return json(o.compare)
      if (path === '/v1/repos/acme/game/tree') return json(rootListing)
      if (path === '/v1/repos/acme/game/summary') return json(summary)
      if (path === '/v1/orgs/studio')
        return json({ id: 'o1', name: 'studio', created_at: '2026-09-01T09:00:00Z', role: 'owner' })
      if (path === '/v1/orgs/studio/profile')
        return o.profile ? json(o.profile) : json({ code: 'x' }, 500)
      if (path === '/v1/users/acme')
        return json({
          user: 'acme',
          id: 'u1',
          created_at: '2026-09-01T09:00:00Z',
          organizations: [],
          repositories: [],
          repository_count: 0,
          profile: { avatar_url: '/v1/users/acme/avatar?v=z' },
        })
      if (path === '/v1/orgs/acme') return json({ code: 'org_not_found' }, 404)
      if (path.startsWith('/v1/owners/')) return json({ frozen: false })
      return json({ code: 'not_found', message: 'x' }, 404)
    }),
  )
}

async function open(path: string, o: Options = {}) {
  stubServer(o)
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

describe('repository page header', () => {
  it('shows the owner / repo title and no global breadcrumb trail', async () => {
    const { w } = await open('/acme/game')
    const shell = w.findComponent(PynRepoShell)
    expect(shell.props('hidePath')).toBeFalsy()
    expect(shell.props('maxTabs')).toBe(5)
    expect(w.find('nav[aria-label="Repository path"]').exists()).toBe(true)
    expect(w.find('nav[aria-label="Breadcrumb"], nav[aria-label="Breadcrumbs"]').exists()).toBe(
      false,
    )
  })

  it('passes the lease, role and organization as header facts', async () => {
    const { w } = await open('/acme/game')
    const facts = w.findComponent(PynRepoShell).props('facts')
    expect(facts?.map((f: { value: string }) => f.value)).toEqual(['24h leases', 'admin'])
  })

  it('hides the lock strip on the Locks tab only', async () => {
    const locks = await open('/acme/game/locks')
    expect(locks.w.findComponent(PynRepoShell).props('hideLockStrip')).toBe(true)
    expect(locks.w.findComponent(PynRepoShell).props('lockedCount')).toBe(2)
    const history = await open('/acme/game/history')
    expect(history.w.findComponent(PynRepoShell).props('hideLockStrip')).toBeFalsy()
  })

  it('shows the lock strip and the Locks badge from the repository locks', async () => {
    const calls: string[] = []
    const { w } = await open('/acme/game/history', { calls })
    const shell = w.findComponent(PynRepoShell)
    expect(shell.props('lockedCount')).toBe(2)
    expect(shell.props('lockHolders')).toEqual(['jamie', 'bob'])
    expect(w.find('[data-lock-strip]').exists()).toBe(true)
    expect(w.find('[aria-hidden="true"][data-count]').text()).toBe('2')
    expect(calls.filter((c) => c === '/v1/repos/acme/game/locks')).toHaveLength(1)
  })

  it('shows neither without locks or when the lock request fails', async () => {
    const none = await open('/acme/game/history', { locks: [] })
    expect(none.w.find('[data-lock-strip]').exists()).toBe(false)
    expect(none.w.find('[aria-hidden="true"][data-count]').exists()).toBe(false)
    const failed = await open('/acme/game/history', { locks: null })
    expect(failed.w.find('[data-lock-strip]').exists()).toBe(false)
    expect(failed.w.findComponent(PynRepoShell).exists()).toBe(true)
  })

  it('refreshes the count from the Code page summary', async () => {
    const { w } = await open('/acme/game', { locks: [] })
    expect(w.findComponent(PynRepoShell).props('lockedCount')).toBe(2)
  })
})

describe('overview Branches panel', () => {
  it('passes the branches the app loads, newest first', async () => {
    const { w } = await open('/acme/game')
    expect(w.findComponent(PynRepoLanding).props('branches')).toEqual([
      { name: 'main', isDefault: true, updatedAt: '2026-10-08T10:00:00Z' },
      { name: 'feature', isDefault: false, updatedAt: '2026-10-07T10:00:00Z' },
    ])
    expect(w.text()).toContain('Branches')
  })

  it('hides the rail Branches panel and keeps the link to the branches page', async () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((n, i) =>
      branch(n, `2026-10-0${i + 1}T10:00:00Z`),
    )
    many.push(branch('main', '2026-09-01T10:00:00Z', true))
    const { w } = await open('/acme/game', { branches: many })
    const landing = w.findComponent(PynRepoLanding)
    expect(landing.props('hideRailBranches')).toBe(true)
    expect(landing.props('branchesHref')).toBe('/acme/game/branches')
    expect(landing.props('railBranches')).toBeUndefined()
    expect(landing.props('branches')).toHaveLength(7)
  })

  it('wires the code toolbar: go to file opens the palette, no ZIP and no SSH yet', async () => {
    const { w } = await open('/acme/game')
    const landing = w.findComponent(PynRepoLanding)
    expect(landing.props('goToFile')).toBe(true)
    expect(landing.props('about')).toEqual({ stars: 0 })
    expect(landing.props('downloadZip')).toBeFalsy()
    expect(landing.props('sshUrl')).toBeUndefined()
  })

  it('adds ahead and behind for the compared branch only', async () => {
    const compare = {
      base: 'main',
      head: 'feature',
      status: 'diverged',
      ahead: 3,
      behind: 1,
      changes: [],
      truncated: false,
      counts_capped: false,
      max_commits: 1000,
    }
    const { w } = await open('/acme/game?branch=feature', { compare })
    const rail = w.findComponent(PynRepoLanding).props('branches') ?? []
    expect(rail.find((b: { name: string }) => b.name === 'feature')).toMatchObject({
      ahead: 3,
      behind: 1,
    })
    expect(rail.find((b: { name: string }) => b.name === 'main')).not.toHaveProperty('ahead')
  })

  it('renders nothing without branches', async () => {
    const { w } = await open('/acme/game', { branches: [] })
    expect(w.findComponent(PynRepoLanding).props('branches')).toEqual([])
    expect(w.find('#branches-title').exists()).toBe(false)
  })

  it('sorts branches newest first and keeps the helpers pure', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      name: `b${i}`,
      updatedAt: `2026-10-0${i}`,
    }))
    expect(railBranches(many).map((b) => b.name)).toEqual([
      'b7',
      'b6',
      'b5',
      'b4',
      'b3',
      'b2',
      'b1',
      'b0',
    ])
    expect(lockHolders(summary.locks.concat(summary.locks))).toEqual(['jamie', 'bob'])
  })
})

describe('organization and owner headers', () => {
  it('fills the organization header from the profile', async () => {
    const profile = {
      name: 'studio',
      description: 'We make games',
      avatar_url: '/v1/orgs/studio/avatar?v=abc',
    }
    const { w } = await open('/studio', { profile })
    const header = w.findComponent(PynOrgHeader)
    expect(header.props('description')).toBe('We make games')
    expect(header.props('avatarUrl')).toBe('/v1/orgs/studio/avatar?v=abc')
    expect(header.props('maxTabs')).toBe(6)
    expect(header.find('[data-description]').text()).toBe('We make games')
    expect(header.find('img').attributes('src')).toBe('/v1/orgs/studio/avatar?v=abc')
  })

  it('shows the name alone when there is no profile', async () => {
    const { w } = await open('/studio')
    const header = w.findComponent(PynOrgHeader)
    expect(header.props('description')).toBeUndefined()
    expect(header.find('[data-description]').exists()).toBe(false)
    expect(header.find('h1').text()).toContain('studio')
  })

  it('shows one identity block on a user profile, without the user header', async () => {
    const { w } = await open('/acme')
    expect(w.findComponent(PynUserHeader).exists()).toBe(false)
    expect(w.findComponent(PynOrgHeader).exists()).toBe(false)
    expect(w.findAll('h1')).toHaveLength(1)
    expect(w.findComponent(PynProfileHeader).props('avatarUrl')).toBe('/v1/users/acme/avatar?v=z')
  })
})

interface Section {
  id: string
  href: string
}

describe('settings areas keep every section', () => {
  const hasAll = (got: Section[], expected: Section[]) => {
    for (const e of expected) expect(got).toContainEqual(expect.objectContaining(e))
  }
  const sectionsOf = (w: ReturnType<typeof mount>) =>
    w.findComponent(PynSettingsLayout).props('sections') as Section[]

  it('account settings', async () => {
    const router = makeRouter(createMemoryHistory())
    await router.push('/_/settings/keys')
    await router.isReady()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json({ code: 'x' }, 404)),
    )
    const w = mount(AccountView, { global: { plugins: [router], stubs: { RouterView: true } } })
    await flushPromises()
    hasAll(sectionsOf(w), [
      { id: 'profile-settings', href: '/_/settings/profile' },
      { id: 'emails', href: '/_/settings/emails' },
      { id: 'username', href: '/_/settings/username' },
      { id: 'password', href: '/_/settings/password' },
      { id: 'keys', href: '/_/settings/keys' },
      { id: 'tokens', href: '/_/settings/tokens' },
      { id: 'security', href: '/_/settings/security' },
      { id: 'delete-account', href: '/_/settings/delete' },
    ])
    expect(w.findComponent(PynAccountSettings).props('current')).toBe('keys')
    expect(w.find('[aria-current="page"]').text()).toBe('SSH keys')
  })

  it('administration keeps its heading and every section', async () => {
    const router = makeRouter(createMemoryHistory())
    await router.push('/_/admin/webhooks')
    await router.isReady()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json({ code: 'x' }, 404)),
    )
    const w = mount(AdminView, {
      global: {
        plugins: [router],
        stubs: { RouterView: true },
        provide: {
          [sessionKey as symbol]: { user: ref('bob'), admin: ref(true), expire: vi.fn() },
        },
      },
    })
    await flushPromises()
    hasAll(sectionsOf(w), [
      { id: 'accounts', href: '/_/admin/accounts' },
      { id: 'invitations', href: '/_/admin/invitations' },
      { id: 'access', href: '/_/admin/access' },
      { id: 'two-factor', href: '/_/admin/two-factor' },
      { id: 'access-sessions', href: '/_/admin/access-sessions' },
      { id: 'audit', href: '/_/admin/audit' },
      { id: 'webhooks', href: '/_/admin/webhooks' },
    ])
    expect(w.findComponent(PynAdminLayout).props('current')).toBe('webhooks')
    expect(w.find('h2').text()).toBe('Server administration')
    expect(w.find('[aria-current="page"]').text()).toBe('Webhooks')
  })

  it('repository settings', async () => {
    const router = makeRouter(createMemoryHistory())
    await router.push('/acme/game/settings/policy')
    await router.isReady()
    const w = mount(RepoSettingsLayout, {
      global: {
        plugins: [router],
        stubs: { RouterView: true },
        provide: {
          [sessionKey as symbol]: { user: ref('acme'), admin: ref(false), expire: vi.fn() },
          [repoKey as symbol]: {
            target: computed(() => ({ owner: 'acme', name: 'game' })),
            repo: ref(repo),
            permissions: ref(['read', 'manage_users', 'manage_roles', 'edit_policy', 'view_audit']),
            org: ref(null),
            frozen: ref(false),
            locks: ref(null),
            branches: ref([]),
            reload: vi.fn(),
          },
        },
      },
    })
    await flushPromises()
    hasAll(sectionsOf(w), [
      { id: 'settings', href: '/acme/game/settings' },
      { id: 'members', href: '/acme/game/settings/members' },
      { id: 'roles', href: '/acme/game/settings/roles' },
      { id: 'policy', href: '/acme/game/settings/policy' },
      { id: 'storage', href: '/acme/game/settings/storage' },
      { id: 'audit', href: '/acme/game/settings/audit' },
    ])
    expect(w.find('[aria-current="page"]').text()).toBe('Policy')
  })

  it('organization tabs for an owner', async () => {
    const { w } = await open('/studio/-/audit')
    const links = w
      .findComponent(PynOrgHeader)
      .findAll('nav a')
      .map((a) => a.attributes('href'))
    expect(links).toEqual([
      '/studio',
      '/studio/-/members',
      '/studio/-/teams',
      '/studio/-/usage',
      '/studio/-/audit',
      '/studio/-/settings',
    ])
    expect(w.find('nav[aria-label="Organization"] [aria-current="page"]').text()).toBe('Audit')
  })
})
