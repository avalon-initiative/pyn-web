import {
  PynButton,
  PynOrgHome,
  PynRepoForm,
  PynRepoList,
  PynSettingsToggle,
  PynTextArea,
  PynTextField,
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
  aboutFields,
  aboutRequest,
  parseTopics,
  topLanguages,
  topTopics,
} from '../src/state/repo-about.state'
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
  it('splits, lowercases and dedupes topics', () => {
    expect(parseTopics(' Game, castle  game,,rpg ')).toEqual({
      topics: ['game', 'castle', 'rpg'],
      error: '',
    })
    expect(parseTopics('')).toEqual({ topics: [], error: '' })
  })

  it('refuses a topic outside a-z0-9- or longer than 50, and more than 20', () => {
    expect(parseTopics('c++').error).toContain('"c++"')
    expect(parseTopics('a'.repeat(51)).error).not.toBe('')
    expect(parseTopics('a'.repeat(50)).error).toBe('')
    const many = Array.from({ length: 21 }, (_, i) => `t${i}`).join(',')
    expect(parseTopics(many).error).toBe('At most 20 topics.')
  })

  it('clears blank description and website with null', () => {
    expect(aboutRequest({ description: '  ', website: '', topics: '' }, [])).toEqual({
      description: null,
      website: null,
      topics: [],
    })
    expect(
      aboutFields(described({ description: 'd', website: 'https://x.dev', topics: ['a', 'b'] })),
    ).toEqual({ description: 'd', website: 'https://x.dev', topics: 'a, b' })
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
const saveButton = (w: ReturnType<typeof mount>) =>
  w.findAllComponents(PynButton).find((b) => b.props('label') === 'Save changes')!

describe('repository settings About', () => {
  it('prefills and saves description, website and topics', async () => {
    const repo = described({ description: 'old', topics: ['game'] })
    vi.mocked(reposApi.updateRepo).mockResolvedValue(repo)
    const { w, reload } = mountGeneral(repo)
    await flushPromises()
    const area = w.findComponent(PynTextArea)
    expect(area.props('modelValue')).toBe('old')
    expect(area.props('maxlength')).toBe(350)
    expect(field(w, 'Topics').props('modelValue')).toBe('game')
    area.vm.$emit('update:modelValue', 'A castle game')
    field(w, 'Website').vm.$emit('update:modelValue', ' ')
    field(w, 'Topics').vm.$emit('update:modelValue', 'Game, RPG')
    await flushPromises()
    await saveButton(w).trigger('click')
    await flushPromises()
    expect(reposApi.updateRepo).toHaveBeenCalledWith(
      { owner: 'alice', name: repo.name },
      { description: 'A castle game', website: null, topics: ['game', 'rpg'] },
    )
    expect(reload).toHaveBeenCalled()
  })

  it('shows a topic error and does not save', async () => {
    const { w } = mountGeneral(described({}))
    await flushPromises()
    field(w, 'Topics').vm.$emit('update:modelValue', 'c++')
    await flushPromises()
    expect(field(w, 'Topics').props('error')).toContain('c++')
    expect(saveButton(w).props('disabled')).toBe(true)
    await saveButton(w).trigger('click')
    expect(reposApi.updateRepo).not.toHaveBeenCalled()
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
})

describe('new repository description', () => {
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
