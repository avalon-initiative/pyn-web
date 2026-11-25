import {
  PynButton,
  PynOrgHome,
  PynRepoForm,
  PynRepoList,
  PynRepoVisibility,
  PynSettingsToggle,
  PynTextArea,
  PynTextField,
  PynTopicsInput,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createMemoryHistory, routerKey } from 'vue-router'
import * as orgsApi from '../src/api/orgs'
import * as reposApi from '../src/api/repos'
import { makeRouter } from '../src/router'
import { orgKey, repoKey, sessionKey } from '../src/state/context.state'
import {
  aboutChanged,
  aboutFields,
  aboutRequest,
  topLanguages,
  topTopics,
} from '../src/state/repo-about.state'
import { repoRows } from '../src/state/repo.state'
import type { RepoDetails } from '../src/types/repo.types'
import NewRepoView from '../src/views/NewRepoView.vue'
import OwnerView from '../src/views/OwnerView.vue'
import RepoGeneralView from '../src/views/RepoGeneralView.vue'
import ReposView from '../src/views/ReposView.vue'
import { orgs } from './fixtures/org-data'
import { sampleRepos } from './fixtures/shell-data'

vi.mock('../src/api/orgs')
vi.mock('../src/api/repos')

const session = {
  [sessionKey as symbol]: { user: ref('alice'), admin: ref(false), expire: vi.fn() },
}

const described = (over: Partial<RepoDetails>): RepoDetails => ({ ...sampleRepos[0], ...over })

beforeEach(() => vi.resetAllMocks())

describe('about fields', () => {
  it('clears blank description and website with null', () => {
    expect(aboutRequest({ description: '  ', website: '', topics: [] })).toEqual({
      description: null,
      website: null,
      topics: [],
    })
    expect(
      aboutFields(described({ description: 'd', website: 'https://x.dev', topics: ['a', 'b'] })),
    ).toEqual({ description: 'd', website: 'https://x.dev', topics: ['a', 'b'] })
  })

  it('tells edited fields from the saved ones', () => {
    const r = described({ description: 'd', topics: ['a'] })
    expect(aboutChanged(aboutFields(r), r)).toBe(false)
    expect(aboutChanged({ ...aboutFields(r), topics: ['a', 'b'] }, r)).toBe(true)
  })

  it('ranks languages by total bytes and topics by use', () => {
    const repos = [
      described({
        languages: [
          { name: 'Rust', bytes: 100 },
          { name: 'C++', bytes: 50 },
        ],
        topics: ['game', 'engine'],
      }),
      described({ languages: [{ name: 'C++', bytes: 80 }], topics: ['game'] }),
    ]
    expect(topLanguages(repos)).toEqual(['C++', 'Rust'])
    expect(topTopics(repos)).toEqual(['game', 'engine'])
  })
})

describe('repository rows', () => {
  it('pass the description, language, topics and update time to the list', async () => {
    const repo = described({
      description: 'A castle game',
      language: 'Rust',
      topics: ['game'],
      updated_at: '2026-11-20T09:00:00Z',
    })
    vi.mocked(reposApi.listRepos).mockResolvedValue([repo])
    const w = mount(ReposView, { global: { plugins: [makeRouter(createMemoryHistory())] } })
    await flushPromises()
    expect(w.findComponent(PynRepoList).props('repos')[0]).toMatchObject({
      description: 'A castle game',
      language: 'Rust',
      topics: ['game'],
      updated_at: '2026-11-20T09:00:00Z',
    })
    expect(w.text()).toContain('A castle game')
    expect(w.text()).toContain('Updated')
    expect(w.text()).not.toContain('Created')
  })

  it('fill the organization rail with top languages and topics', async () => {
    vi.mocked(reposApi.listRepos).mockResolvedValue([
      described({ languages: [{ name: 'Rust', bytes: 10 }], topics: ['game'] }),
    ])
    vi.mocked(orgsApi.listOrgMembers).mockResolvedValue([])
    const w = mount(OwnerView, {
      global: {
        plugins: [makeRouter(createMemoryHistory())],
        provide: {
          ...session,
          [orgKey as symbol]: {
            name: computed(() => 'studio'),
            org: ref(orgs[0]),
            frozen: ref(false),
            reload: vi.fn(),
          },
        },
      },
    })
    await flushPromises()
    const home = w.findComponent(PynOrgHome)
    expect(home.props('languages')).toEqual(['Rust'])
    expect(home.props('topics')).toEqual(['game'])
  })

  it('carry stars, forks, the icon and the owner avatar, initials when the owner has none on the wire', () => {
    const org = described({
      star_count: 3,
      fork_count: 1,
      owner_identity: { user: 'studio', avatar_url: '/v1/orgs/studio/avatar?v=1' },
    })
    const person = described({
      owner_identity: { user: 'alice', avatar_url: '/v1/users/alice/avatar?v=2' },
    })
    const user = described({ owner_identity: null })
    expect(repoRows([org, person, user])).toMatchObject([
      { star_count: 3, fork_count: 1, owner_avatar_url: '/v1/orgs/studio/avatar?v=1' },
      { owner_avatar_url: '/v1/users/alice/avatar?v=2' },
      { owner_avatar_url: null },
    ])
    expect(repoRows([user])[0].icon_url).toBeNull()
    expect(repoRows([described({ icon_url: '/v1/repos/alice/x/icon?v=ab' })])[0].icon_url).toBe(
      '/v1/repos/alice/x/icon?v=ab',
    )
  })

  it('leave the organization rail sections out without data', async () => {
    vi.mocked(reposApi.listRepos).mockResolvedValue(sampleRepos)
    vi.mocked(orgsApi.listOrgMembers).mockResolvedValue([])
    const w = mount(OwnerView, {
      global: {
        plugins: [makeRouter(createMemoryHistory())],
        provide: {
          ...session,
          [orgKey as symbol]: {
            name: computed(() => 'studio'),
            org: ref(orgs[0]),
            frozen: ref(false),
            reload: vi.fn(),
          },
        },
      },
    })
    await flushPromises()
    expect(w.findComponent(PynOrgHome).props('languages')).toBeUndefined()
    expect(w.findComponent(PynOrgHome).props('topics')).toBeUndefined()
  })
})

function mountGeneral(repo: RepoDetails) {
  const reload = vi.fn()
  const w = mount(RepoGeneralView, {
    global: {
      provide: {
        [routerKey as symbol]: { replace: vi.fn(), push: vi.fn() },
        [sessionKey as symbol]: { user: ref('alice'), admin: ref(false), expire: vi.fn() },
        [repoKey as symbol]: {
          target: computed(() => ({ owner: 'alice', name: repo.name })),
          repo: ref(repo),
          permissions: ref(['read']),
          org: ref(null),
          frozen: ref(false),
          reload,
        },
      },
    },
  })
  return { w, reload }
}

const field = (w: ReturnType<typeof mount>, label: string) =>
  w.findAllComponents(PynTextField).find((f) => f.props('label') === label)!
const button = (w: ReturnType<typeof mount>, label: string) =>
  w.findAllComponents(PynButton).find((b) => b.props('label') === label)!
const saveButton = (w: ReturnType<typeof mount>) => button(w, 'Save changes')

describe('repository settings About', () => {
  it('prefills and saves description, website and topics', async () => {
    const repo = described({ description: 'old', topics: ['game'] })
    vi.mocked(reposApi.updateRepo).mockResolvedValue(repo)
    const { w, reload } = mountGeneral(repo)
    await flushPromises()
    const area = w.findComponent(PynTextArea)
    expect(area.props('modelValue')).toBe('old')
    expect(area.props('maxlength')).toBe(350)
    const topics = w.findComponent(PynTopicsInput)
    expect(topics.props('modelValue')).toEqual(['game'])
    area.vm.$emit('update:modelValue', 'A castle game')
    field(w, 'Website').vm.$emit('update:modelValue', ' ')
    topics.vm.$emit('update:modelValue', ['game', 'rpg'])
    await flushPromises()
    await saveButton(w).trigger('click')
    await flushPromises()
    expect(reposApi.updateRepo).toHaveBeenCalledWith(
      { owner: 'alice', name: repo.name },
      { description: 'A castle game', website: null, topics: ['game', 'rpg'] },
    )
    expect(reload).toHaveBeenCalled()
  })

  it('adds a typed topic on save and refuses one that cannot be added', async () => {
    const repo = described({ topics: [] })
    vi.mocked(reposApi.updateRepo).mockResolvedValue(repo)
    const { w } = mountGeneral(repo)
    await flushPromises()
    const input = w.findComponent(PynTopicsInput).find('input')
    await input.setValue('c++')
    await saveButton(w).trigger('click')
    await flushPromises()
    expect(reposApi.updateRepo).not.toHaveBeenCalled()
    await input.setValue('Castle')
    await saveButton(w).trigger('click')
    await flushPromises()
    expect(reposApi.updateRepo).toHaveBeenCalledWith(
      { owner: 'alice', name: repo.name },
      expect.objectContaining({ topics: ['castle'] }),
    )
  })

  it('puts a server topic refusal under the topics field', async () => {
    vi.mocked(reposApi.updateRepo).mockRejectedValue(new Error('too many topics'))
    const { w } = mountGeneral(described({}))
    await flushPromises()
    await saveButton(w).trigger('click')
    await flushPromises()
    expect(w.findComponent(PynTopicsInput).props('error')).toContain('too many topics')
  })

  it('keeps Save and Cancel in the section footer and Cancel resets', async () => {
    const { w } = mountGeneral(described({ description: 'old' }))
    await flushPromises()
    expect(button(w, 'Cancel').props('disabled')).toBe(true)
    w.findComponent(PynTextArea).vm.$emit('update:modelValue', 'new')
    await flushPromises()
    expect(button(w, 'Cancel').props('disabled')).toBe(false)
    await button(w, 'Cancel').trigger('click')
    await flushPromises()
    expect(w.findComponent(PynTextArea).props('modelValue')).toBe('old')
    expect(w.find('[data-about] [data-footer]').text()).toBe('CancelSave changes')
  })

  it('no longer passes About fields through the settings form', async () => {
    const { w } = mountGeneral(described({ description: 'x' }))
    await flushPromises()
    expect(w.findComponent(PynRepoForm).props('repo')).not.toHaveProperty('description')
  })

  it('offers the private fork switch on a private repository only', async () => {
    const repo = described({ visibility: 'private', allow_private_forks: false })
    vi.mocked(reposApi.updateRepo).mockResolvedValue({ ...repo, allow_private_forks: true })
    const { w, reload } = mountGeneral(repo)
    await flushPromises()
    const toggle = w
      .findAllComponents(PynSettingsToggle)
      .find((t) => t.props('title') === 'Allow forking')!
    expect(toggle.props('modelValue')).toBe(false)
    toggle.vm.$emit('update:modelValue', true)
    await flushPromises()
    expect(reposApi.updateRepo).toHaveBeenCalledWith(
      { owner: 'alice', name: repo.name },
      { allow_private_forks: true },
    )
    expect(reload).toHaveBeenCalled()

    const open = mountGeneral(described({ visibility: 'public' }))
    await flushPromises()
    expect(open.w.find('[data-forks]').exists()).toBe(false)
  })

  it('changes visibility from the danger zone and reloads', async () => {
    const repo = described({ visibility: 'private' })
    vi.mocked(reposApi.updateRepo).mockResolvedValue({ ...repo, visibility: 'public' })
    const { w, reload } = mountGeneral(repo)
    await flushPromises()
    const row = w.findComponent(PynRepoVisibility)
    expect(row.props()).toMatchObject({ visibility: 'private', slug: `alice/${repo.name}` })
    row.vm.$emit('change', 'public')
    await flushPromises()
    expect(reposApi.updateRepo).toHaveBeenCalledWith(
      { owner: 'alice', name: repo.name },
      { visibility: 'public' },
    )
    expect(reload).toHaveBeenCalled()
  })
})

describe('new repository description', () => {
  it('shows the website and topics fields and sends them', async () => {
    vi.mocked(orgsApi.listMyOrgs).mockResolvedValue([])
    vi.mocked(reposApi.createRepo).mockResolvedValue(sampleRepos[0])
    const w = mount(NewRepoView, {
      global: { plugins: [makeRouter(createMemoryHistory())], provide: session },
    })
    await flushPromises()
    const form = w.findComponent(PynRepoForm)
    expect(form.props('websiteField')).toBe(true)
    expect(form.props('topicsField')).toBe(true)
    form.vm.$emit('submit', {
      name: 'castle',
      visibility: 'public',
      lease_hours: 8,
      website: 'https://castle.dev',
      topics: ['game'],
    })
    await flushPromises()
    expect(reposApi.createRepo).toHaveBeenCalledWith(
      'alice',
      expect.objectContaining({ website: 'https://castle.dev', topics: ['game'] }),
      true,
    )
  })

  it('sends the description the form gives', async () => {
    vi.mocked(orgsApi.listMyOrgs).mockResolvedValue([])
    vi.mocked(reposApi.createRepo).mockResolvedValue(sampleRepos[0])
    const w = mount(NewRepoView, {
      global: { plugins: [makeRouter(createMemoryHistory())], provide: session },
    })
    await flushPromises()
    w.findComponent(PynRepoForm).vm.$emit('submit', {
      name: 'castle',
      visibility: 'public',
      lease_hours: 8,
      description: 'A castle game',
    })
    await flushPromises()
    expect(reposApi.createRepo).toHaveBeenCalledWith(
      'alice',
      expect.objectContaining({ description: 'A castle game' }),
      true,
    )
  })
})
