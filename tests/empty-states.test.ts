import {
  PynActivity,
  PynBranchBar,
  PynEmptyState,
  PynOrgList,
  PynQuickSetup,
  PynRepoLanding,
  PynRepoForm,
  PynRepoList,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import * as orgsApi from '../src/api/orgs'
import * as profileApi from '../src/api/profile'
import * as reposApi from '../src/api/repos'
import { makeRouter } from '../src/router'
import { orgKey, repoKey, sessionKey } from '../src/state/context.state'
import InvitationsView from '../src/views/InvitationsView.vue'
import MyLocksView from '../src/views/MyLocksView.vue'
import NewOrgView from '../src/views/NewOrgView.vue'
import NewRepoView from '../src/views/NewRepoView.vue'
import OrgsView from '../src/views/OrgsView.vue'
import OwnerView from '../src/views/OwnerView.vue'
import RepoFilesView from '../src/views/RepoFilesView.vue'
import ReposView from '../src/views/ReposView.vue'
import { invitations, orgs } from './fixtures/org-data'
import { repo as landingRepo } from './fixtures/landing-data'
import { sampleRepos } from './fixtures/shell-data'

vi.mock('../src/api/orgs')
vi.mock('../src/api/profile')
vi.mock('../src/api/repos')

const router = makeRouter(createMemoryHistory())
const session = {
  [sessionKey as symbol]: { user: ref('alice'), admin: ref(false), expire: vi.fn() },
}
const options = (provide: Record<symbol, unknown> = session) => ({
  global: { plugins: [router], provide },
})
const resolves = (href: string) =>
  router.resolve(href).name !== undefined && router.resolve(href).matched.length > 0
const action = (w: ReturnType<typeof mount>) => w.findComponent(PynEmptyState)

beforeEach(() => vi.resetAllMocks())

describe('repository list', () => {
  it('offers to create one when the person is in none', async () => {
    vi.mocked(reposApi.listRepos).mockResolvedValue([])
    const w = mount(ReposView, options())
    await flushPromises()
    expect(action(w).props('primaryLabel')).toBe('Create a repository')
    expect(action(w).props('primaryHref')).toBe('/_/new')
    expect(resolves('/_/new')).toBe(true)
    expect(w.findComponent(PynRepoList).exists()).toBe(false)
  })

  it('lists repositories when there are some', async () => {
    vi.mocked(reposApi.listRepos).mockResolvedValue(sampleRepos)
    const w = mount(ReposView, options())
    await flushPromises()
    expect(action(w).exists()).toBe(false)
    expect(w.findComponent(PynRepoList).props('repos')).toHaveLength(3)
  })
})

describe('organization list', () => {
  it('offers to create one when empty', async () => {
    vi.mocked(orgsApi.listMyOrgs).mockResolvedValue([])
    const w = mount(OrgsView, options())
    await flushPromises()
    expect(action(w).props('primaryLabel')).toBe('Create an organization')
    expect(resolves(action(w).props('primaryHref')!)).toBe(true)
    expect(w.findComponent(PynOrgList).exists()).toBe(false)
  })

  it('lists organizations when there are some', async () => {
    vi.mocked(orgsApi.listMyOrgs).mockResolvedValue(orgs)
    const w = mount(OrgsView, options())
    await flushPromises()
    expect(action(w).exists()).toBe(false)
    expect(w.findComponent(PynOrgList).exists()).toBe(true)
  })
})

describe('owner page', () => {
  const ctx = (name: string, org: (typeof orgs)[number] | null) => ({
    ...session,
    [orgKey as symbol]: {
      name: computed(() => name),
      org: ref(org),
      frozen: ref(false),
      reload: vi.fn(),
    },
  })
  const profile = (user: string, repositories: typeof sampleRepos) =>
    ({
      user,
      profile: {},
      repositories,
      organizations: [],
      created_at: '2026-01-01T00:00:00Z',
    }) as never

  it('offers the owner of an empty profile a way to create a repository', async () => {
    vi.mocked(profileApi.getProfile).mockResolvedValue(profile('alice', []))
    const w = mount(OwnerView, options(ctx('alice', null)))
    await flushPromises()
    expect(action(w).props('primaryLabel')).toBe('Create a repository')
    expect(resolves(action(w).props('primaryHref')!)).toBe(true)
  })

  it('tells a visitor plainly, with no action', async () => {
    vi.mocked(profileApi.getProfile).mockResolvedValue(profile('bob', []))
    const w = mount(OwnerView, options(ctx('bob', null)))
    await flushPromises()
    expect(action(w).props('title')).toBe('bob has no repositories you can see')
    expect(action(w).props('primaryLabel')).toBeUndefined()
  })

  it('treats an organization by the viewer role', async () => {
    vi.mocked(reposApi.listRepos).mockResolvedValue([])
    const owner = mount(OwnerView, options(ctx('studio', orgs[0])))
    await flushPromises()
    expect(action(owner).props('primaryLabel')).toBe('Create a repository')
    expect(action(owner).props('primaryHref')).toBe('/_/new?owner=studio')
    const member = mount(OwnerView, options(ctx('modding-club', orgs[1])))
    await flushPromises()
    expect(action(member).props('primaryLabel')).toBeUndefined()
  })

  it('lists repositories when there are some', async () => {
    vi.mocked(reposApi.listRepos).mockResolvedValue(sampleRepos)
    const w = mount(OwnerView, options(ctx('studio', orgs[0])))
    await flushPromises()
    expect(action(w).exists()).toBe(false)
    expect(w.findComponent(PynRepoList).exists()).toBe(true)
  })
})

describe('my locks', () => {
  it('says nothing is held and how locks are taken', async () => {
    vi.mocked(reposApi.listMyLocks).mockResolvedValue([])
    const w = mount(MyLocksView, options())
    await flushPromises()
    expect(action(w).props('title')).toBe('You hold no locks')
    expect(action(w).props('description')).toContain('pyn lock <path>')
    expect(resolves(action(w).props('primaryHref')!)).toBe(true)
  })

  it('lists held locks', async () => {
    vi.mocked(reposApi.listMyLocks).mockResolvedValue([
      {
        ...sampleRepos[0],
        owner: 'alice',
        name: 'castle-quest',
        path: 'hero.png',
        acquired_at: '2026-10-01T09:00:00Z',
        expires_at: '2099-10-01T09:00:00Z',
      } as never,
    ])
    const w = mount(MyLocksView, options())
    await flushPromises()
    expect(action(w).exists()).toBe(false)
    expect(w.text()).toContain('hero.png')
  })
})

describe('invitations', () => {
  it('shows an empty state, then the list', async () => {
    vi.mocked(orgsApi.listMyInvitations).mockResolvedValue([])
    const empty = mount(InvitationsView, options())
    await flushPromises()
    expect(action(empty).props('title')).toBe('No pending invitations')
    vi.mocked(orgsApi.listMyInvitations).mockResolvedValue(invitations)
    const full = mount(InvitationsView, options())
    await flushPromises()
    expect(action(full).exists()).toBe(false)
    expect(full.text()).toContain('studio')
  })
})

describe('repository with no files yet', () => {
  const entry = (name: string, kind: 'file' | 'folder') =>
    ({ name, path: name, kind, mode: 'shared' }) as never
  const open = async (entries: never[], path = '', extra: Record<string, unknown> = {}) => {
    vi.mocked(reposApi.fetchTree).mockResolvedValue({ path, entries })
    vi.mocked(reposApi.fetchSummary).mockResolvedValue({
      default_branch: 'main',
      files: 0,
      exclusive_files: 0,
      shared_files: 0,
      locks: [],
      activity: [],
      ...extra,
    } as never)
    await router.push(path ? `/acme/castle-quest/tree/${path}` : '/acme/castle-quest')
    const provide = {
      ...session,
      [repoKey as symbol]: {
        target: computed(() => ({ owner: 'acme', name: 'castle-quest' })),
        repo: ref(landingRepo),
        permissions: ref(['read']),
        org: ref(null),
        frozen: ref(false),
        reload: vi.fn(),
      },
    }
    const w = mount(RepoFilesView, options(provide))
    await flushPromises()
    return w
  }

  it('shows the quick setup with the address when the root has only .pyn', async () => {
    const w = await open([entry('.pyn', 'folder')])
    const setup = w.findComponent(PynQuickSetup)
    expect(setup.exists()).toBe(true)
    expect(setup.props('httpsUrl')).toBe(`${window.location.origin}/acme/castle-quest`)
    expect(setup.props('command')).toBe('pyn clone acme/castle-quest')
    expect(w.findComponent(PynBranchBar).exists()).toBe(false)
  })

  it('caps the recent activity at five items', async () => {
    const activity = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      at: '2026-10-08T10:00:00Z',
      actor: 'jamie',
      action: 'checkin',
      path: `f${i}`,
    }))
    const w = await open([entry('a', 'file')], '', { activity })
    expect(w.findComponent(PynActivity).findAll('li')).toHaveLength(5)
  })

  it('also shows it for a completely empty root', async () => {
    expect((await open([])).findComponent(PynQuickSetup).exists()).toBe(true)
  })

  it('shows the landing page when anything else is in the root', async () => {
    const w = await open([entry('.pyn', 'folder'), entry('hero.png', 'file')])
    expect(w.findComponent(PynQuickSetup).exists()).toBe(false)
    expect(w.findComponent(PynRepoLanding).exists()).toBe(true)
  })

  it('never triggers inside a subfolder', async () => {
    const w = await open([entry('.pyn', 'folder')], 'Content')
    expect(w.findComponent(PynQuickSetup).exists()).toBe(false)
  })
})

describe('create forms', () => {
  it('preselect the organization named in the address', async () => {
    vi.mocked(orgsApi.listMyOrgs).mockResolvedValue(orgs)
    const owned = async (q: string) => {
      await router.push(`/_/new?owner=${q}`)
      const w = mount(NewRepoView, options())
      await flushPromises()
      return w.findComponent(PynRepoForm).props('owner')
    }
    expect(await owned('studio')).toBe('studio')
    expect(await owned('someone-else')).toBe('alice')
  })

  it('link Cancel back to a real list', () => {
    for (const [view, href] of [
      [NewRepoView, '/'],
      [NewOrgView, '/_/orgs'],
    ] as const) {
      vi.mocked(orgsApi.listMyOrgs).mockResolvedValue([])
      const w = mount(view, options())
      const cancel = w.findAll('a').find((a) => a.text() === 'Cancel')
      expect(cancel?.attributes('href')).toBe(href)
      expect(resolves(href)).toBe(true)
    }
  })
})
