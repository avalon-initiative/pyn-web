import { PynLocks, PynOrgMembers, PynOwnerFrozenNotice } from '@avalon-initiative/pyn-common-ui'
import type { OwnerFreeze } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import { ApiError, describeError } from '../src/api/client'
import { getOwnerFreeze } from '../src/api/orgs'
import { orgKey, repoKey, sessionKey } from '../src/state/context.state'
import { canWrite, useOwnerFreeze, whileFrozen } from '../src/state/freeze.state'
import { policyConflict } from '../src/state/policy.state'
import RepoLocksView from '../src/views/RepoLocksView.vue'
import OrgMembersView from '../src/views/OrgMembersView.vue'
import { orgs } from './fixtures/org-data'

const freeze = (frozen: boolean, owner = 'acme'): OwnerFreeze => ({
  owner,
  owner_id: 'id',
  kind: 'user',
  frozen,
  frozen_at: frozen ? '2026-01-02T03:04:05Z' : null,
  reason: frozen ? 'billing' : null,
})

function harness(owner: ReturnType<typeof ref<string>>, read: (o: string) => Promise<OwnerFreeze>) {
  let state!: ReturnType<typeof useOwnerFreeze>
  mount(
    defineComponent({
      setup() {
        state = useOwnerFreeze(owner as never, read)
        return () => h('div')
      },
    }),
  )
  return state
}

describe('useOwnerFreeze', () => {
  it('loads the freeze and exposes frozen', async () => {
    const s = harness(ref('acme'), async (o) => freeze(true, o))
    await flushPromises()
    expect(s.frozen.value).toBe(true)
    expect(s.freeze.value?.reason).toBe('billing')
  })

  it('reloads when the owner changes', async () => {
    const owner = ref('acme')
    const read = vi.fn(async (o: string) => freeze(o === 'acme', o))
    const s = harness(owner, read)
    await flushPromises()
    expect(s.frozen.value).toBe(true)
    owner.value = 'bob'
    await flushPromises()
    expect(read).toHaveBeenLastCalledWith('bob')
    expect(s.frozen.value).toBe(false)
  })

  it.each([403, 404])('treats a %i read as not frozen', async (status) => {
    const s = harness(ref('acme'), async () => {
      throw new ApiError(status, 'not_namespace_owner', 'm')
    })
    await flushPromises()
    expect(s.freeze.value).toBeNull()
    expect(s.frozen.value).toBe(false)
  })

  it('ignores a stale answer after the owner changed', async () => {
    const owner = ref('acme')
    let release!: (f: OwnerFreeze) => void
    const read = vi.fn((o: string) =>
      o === 'acme'
        ? new Promise<OwnerFreeze>((r) => (release = r))
        : Promise.resolve(freeze(false, o)),
    )
    const s = harness(owner, read)
    owner.value = 'bob'
    await flushPromises()
    release(freeze(true, 'acme'))
    await flushPromises()
    expect(s.frozen.value).toBe(false)
  })
})

describe('freeze api', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads the owner path and maps the wire kind', async () => {
    const fn = vi.fn(
      async () => new Response(JSON.stringify({ ...freeze(true, 'studio'), kind: 'org' })),
    )
    vi.stubGlobal('fetch', fn)
    const f = await getOwnerFreeze('studio')
    expect((fn.mock.calls[0] as unknown[])[0]).toBe('/v1/owners/studio/freeze')
    expect(f.kind).toBe('organization')
    expect(f.frozen).toBe(true)
  })
})

describe('owner_frozen message', () => {
  it('words the refusal clearly', () => {
    const msg = describeError(new ApiError(403, 'owner_frozen', 'server wording'))
    expect(msg).toContain('frozen')
    expect(msg).not.toContain('server wording')
  })

  it('reaches the policy editor as a forbidden conflict', () => {
    const c = policyConflict(new ApiError(403, 'owner_frozen', 'x'))
    expect(c.kind).toBe('forbidden')
    expect(c.message).toContain('frozen')
  })
})

describe('gating', () => {
  it('drops writes while frozen and keeps read', () => {
    expect(canWrite(true, false)).toBe(true)
    expect(canWrite(true, true)).toBe(false)
    expect(canWrite(false, false)).toBe(false)
    expect(whileFrozen(['read', 'edit_policy'], true)).toEqual(['read'])
    expect(whileFrozen(['read', 'edit_policy'], false)).toEqual(['read', 'edit_policy'])
  })

  const session = { user: ref('acme'), admin: ref(false), expire: vi.fn() }

  it('turns force unlock off while frozen', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]')),
    )
    const mountLocks = (frozen: boolean) =>
      mount(RepoLocksView, {
        global: {
          provide: {
            [sessionKey as symbol]: session,
            [repoKey as symbol]: {
              target: computed(() => ({ owner: 'acme', name: 'game' })),
              repo: ref(null),
              permissions: ref(['read', 'force_unlock']),
              org: ref(null),
              frozen: ref(frozen),
              reload: vi.fn(),
            },
          },
        },
      })
    expect(mountLocks(false).findComponent(PynLocks).props('canForce')).toBe(true)
    expect(mountLocks(true).findComponent(PynLocks).props('canForce')).toBe(false)
    vi.unstubAllGlobals()
  })

  it('turns org member management off while frozen', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]')),
    )
    const mountMembers = async (frozen: boolean) => {
      const w = mount(OrgMembersView, {
        global: {
          provide: {
            [sessionKey as symbol]: session,
            [orgKey as symbol]: {
              name: computed(() => 'studio'),
              org: ref({ ...orgs[0], role: 'owner' }),
              frozen: ref(frozen),
              reload: async () => {},
            },
          },
        },
      })
      await flushPromises()
      return w.findComponent(PynOrgMembers).props('owner')
    }
    expect(await mountMembers(false)).toBe(true)
    expect(await mountMembers(true)).toBe(false)
    vi.unstubAllGlobals()
  })

  it('renders the notice only for a frozen owner', async () => {
    const show = (f: OwnerFreeze) => mount(PynOwnerFrozenNotice, { props: { freeze: f } })
    expect(show(freeze(true)).text()).toContain('billing')
    expect(show(freeze(false)).text()).toBe('')
    await nextTick()
  })
})
