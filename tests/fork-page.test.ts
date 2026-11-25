import { PynForkForm } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { routerKey } from 'vue-router'
import * as orgsApi from '../src/api/orgs'
import * as reposApi from '../src/api/repos'
import { ApiError } from '../src/api/client'
import { repoKey, sessionKey } from '../src/state/context.state'
import type { RepoDetails } from '../src/types/repo.types'
import RepoForkView from '../src/views/RepoForkView.vue'
import { orgs } from './fixtures/org-data'
import { sampleRepos } from './fixtures/shell-data'

vi.mock('../src/api/orgs')
vi.mock('../src/api/repos')

function mountFork(over: Partial<RepoDetails> = {}, user = 'alice') {
  const push = vi.fn()
  const repo = {
    ...sampleRepos[0],
    owner: 'acme',
    name: 'game',
    visibility: 'public',
    ...over,
  } as RepoDetails
  const w = mount(RepoForkView, {
    global: {
      provide: {
        [routerKey as symbol]: { push, replace: vi.fn() },
        [sessionKey as symbol]: { user: ref(user), admin: ref(false), expire: vi.fn() },
        [repoKey as symbol]: {
          target: computed(() => ({ owner: 'acme', name: 'game' })),
          repo: ref(repo),
          permissions: ref(['read']),
          org: ref(null),
          frozen: ref(false),
          branches: computed(() => [{ name: 'trunk', isDefault: true }]),
          reload: vi.fn(),
        },
      },
    },
  })
  return { w, push, form: () => w.findComponent(PynForkForm) }
}

const forked = { ...sampleRepos[0], owner: 'studio', name: 'castle' } as RepoDetails

describe('create-fork page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(orgsApi.listMyOrgs).mockResolvedValue(orgs)
    vi.mocked(reposApi.listRepos).mockResolvedValue([])
  })

  it('fills the form from the source and the account', async () => {
    const { form } = mountFork()
    await flushPromises()
    expect(form().props()).toMatchObject({
      source: { owner: 'acme', name: 'game' },
      owner: 'alice',
      name: 'game',
      defaultBranch: 'trunk',
      cancelHref: '/acme/game',
    })
    expect(form().props('owners')?.[0]).toBe('alice')
    form().vm.$emit('nameInput', 'My Castle')
    form().vm.$emit('update:owner', 'studio')
    await flushPromises()
    expect(form().props('nameCanonical')).toBe('my-castle')
    expect(form().props('owner')).toBe('studio')
  })

  it('forks, saves the description and opens the fork', async () => {
    vi.mocked(reposApi.forkRepo).mockResolvedValue(forked)
    vi.mocked(reposApi.updateRepo).mockResolvedValue(forked)
    const { form, push } = mountFork()
    await flushPromises()
    form().vm.$emit('submit', {
      owner: 'studio',
      name: 'My Castle',
      description: ' A fork ',
      default_branch_only: false,
    })
    await flushPromises()
    expect(reposApi.forkRepo).toHaveBeenCalledWith(
      { owner: 'acme', name: 'game' },
      { owner: 'studio', name: 'my-castle', default_branch_only: false },
    )
    expect(reposApi.updateRepo).toHaveBeenCalledWith(forked, { description: 'A fork' })
    expect(push).toHaveBeenCalledWith('/studio/castle')
  })

  it('sends no description when none was entered', async () => {
    vi.mocked(reposApi.forkRepo).mockResolvedValue(forked)
    const { form, push } = mountFork()
    await flushPromises()
    form().vm.$emit('submit', { owner: 'alice', name: 'game', default_branch_only: true })
    await flushPromises()
    expect(reposApi.updateRepo).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/studio/castle')
  })

  it("shows the server's limit message", async () => {
    vi.mocked(reposApi.forkRepo).mockRejectedValue(
      new ApiError(409, 'fork_limit_reached', 'alice has reached the limit of 5 forks.'),
    )
    const { form, push } = mountFork()
    await flushPromises()
    form().vm.$emit('submit', { owner: 'alice', name: 'game', default_branch_only: true })
    await flushPromises()
    expect(form().props('error')).toBe('alice has reached the limit of 5 forks.')
    expect(push).not.toHaveBeenCalled()
  })

  it('does not fork again when only the description failed', async () => {
    vi.mocked(reposApi.forkRepo).mockResolvedValue(forked)
    vi.mocked(reposApi.updateRepo)
      .mockRejectedValueOnce(new ApiError(400, 'invalid_description', 'too long'))
      .mockResolvedValue(forked)
    const { form, push } = mountFork()
    await flushPromises()
    const value = { owner: 'studio', name: 'castle', description: 'd', default_branch_only: true }
    form().vm.$emit('submit', value)
    await flushPromises()
    expect(form().props('error')).toContain('Forked to studio/castle')
    form().vm.$emit('submit', value)
    await flushPromises()
    expect(reposApi.forkRepo).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/studio/castle')
  })

  it('explains a private source that does not allow forks', async () => {
    const { w } = mountFork({ visibility: 'private', allow_private_forks: false })
    await flushPromises()
    expect(w.find('[data-not-forkable]').exists()).toBe(true)
    expect(w.findComponent(PynForkForm).exists()).toBe(false)
  })
})
