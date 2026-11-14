import { PynRepoDelete, PynRepoForm } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { routerKey } from 'vue-router'
import { repoKey, sessionKey } from '../src/state/context.state'
import { canOpenSettings, isRepoOwner } from '../src/state/repo-access.state'
import RepoGeneralView from '../src/views/RepoGeneralView.vue'

vi.mock('../src/api/repos')

const repo = {
  owner: 'acme',
  name: 'game',
  visibility: 'private' as const,
  lease_hours: 8,
  max_locks_per_user: 10,
  max_locks_set_by_policy: false,
  created_at: '2026-10-01T09:00:00Z',
}

function mountSettings(user: string, permissions: string[]) {
  const replace = vi.fn()
  const w = mount(RepoGeneralView, {
    global: {
      provide: {
        [routerKey as symbol]: { replace, push: vi.fn() },
        [sessionKey as symbol]: { user: ref(user), admin: ref(false), expire: vi.fn() },
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
  return { w, replace }
}

describe('settings access', () => {
  it('opens for owners and for edit_policy holders only', () => {
    expect(canOpenSettings([], true)).toBe(true)
    expect(canOpenSettings(['read', 'edit_policy'], false)).toBe(true)
    expect(canOpenSettings(['read', 'manage_roles'], false)).toBe(false)
    expect(isRepoOwner('ann', 'ann', null)).toBe(true)
    expect(isRepoOwner('acme', 'ann', null)).toBe(false)
  })

  it('shows the form and delete to an owner', async () => {
    const { w, replace } = mountSettings('acme', ['read', 'edit_policy'])
    await flushPromises()
    expect(w.findComponent(PynRepoForm).exists()).toBe(true)
    expect(w.findComponent(PynRepoDelete).exists()).toBe(true)
    expect(replace).not.toHaveBeenCalled()
  })

  it('shows nothing on General to a non-owner', async () => {
    const { w } = mountSettings('bob', ['read', 'edit_policy'])
    await flushPromises()
    expect(w.findComponent(PynRepoForm).exists()).toBe(false)
    expect(w.findComponent(PynRepoDelete).exists()).toBe(false)
  })
})
