import { PynOrgInvitations, PynOrgPendingInvitations } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { addOrgMember } from '../src/api/orgs'
import { ApiError, describeError } from '../src/api/client'
import { makeRouter } from '../src/router'
import { orgKey, sessionKey } from '../src/state/context.state'
import { activeNav, sideNavItems } from '../src/state/shell.state'
import { invitations, orgMembers, orgs } from './fixtures/org-data'
import InvitationsView from '../src/views/InvitationsView.vue'
import OrgAuditView from '../src/views/OrgAuditView.vue'
import OrgMembersView from '../src/views/OrgMembersView.vue'

type Handler = (method: string, url: string) => Response | undefined
const calls: string[] = []
const stub = (handler: Handler) =>
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push(`${method} ${url}`)
      return Promise.resolve(handler(method, url) ?? new Response('[]'))
    }),
  )
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const fail = (status: number, code: string) => json({ code, message: 'server wording' }, status)

const session = { user: ref('dave'), admin: ref(false), expire: () => {} }
const orgCtx = (frozen = false) => ({
  name: computed(() => 'studio'),
  org: ref(orgs[0]),
  frozen: ref(frozen),
  reload: async () => {},
})

afterEach(() => {
  vi.unstubAllGlobals()
  calls.length = 0
})

describe('routing and navigation', () => {
  it('has an invitations page and a side nav entry for it', () => {
    expect(makeRouter(createMemoryHistory()).resolve('/_/invitations').name).toBe('invitations')
    expect(sideNavItems(false).find((i) => i.id === 'invitations')?.href).toBe('/_/invitations')
    expect(activeNav('/_/invitations')).toBe('invitations')
  })
})

describe('error wording', () => {
  it('words the invitation errors', () => {
    expect(describeError(new ApiError(409, 'already_invited', 'x'))).toContain('pending invitation')
    expect(describeError(new ApiError(404, 'org_invitation_not_found', 'x'))).toContain('no longer')
    const full = describeError(new ApiError(409, 'member_limit_reached', 'x'))
    expect(full).toContain('member limit')
    expect(full).toContain('invitation stays')
    expect(describeError(new ApiError(403, 'owner_frozen', 'x'))).toContain('frozen')
  })
})

describe('addOrgMember', () => {
  it('reports an invitation on 202 and a direct add on 201', async () => {
    stub(() => json(invitations[0], 202))
    expect(await addOrgMember('studio', { user: 'dave', role: 'member' })).toEqual({
      invited: invitations[0],
    })
    stub(() => json({ user: 'dave', role: 'member' }, 201))
    expect(await addOrgMember('studio', { user: 'dave', role: 'member' })).toEqual({
      added: { user: 'dave', role: 'member' },
    })
  })
})

describe('OrgMembersView invitations', () => {
  const mountView = async (frozen = false) => {
    const w = mount(OrgMembersView, {
      global: { provide: { [sessionKey as symbol]: session, [orgKey as symbol]: orgCtx(frozen) } },
    })
    await flushPromises()
    return w
  }
  const route: Handler = (method, url) => {
    if (url.endsWith('/members') && method === 'GET') return json(orgMembers)
    if (url.endsWith('/invitations') && method === 'GET') return json([invitations[0]])
    return undefined
  }

  it('lists pending invitations and cancels one', async () => {
    stub(route)
    const w = await mountView()
    expect(w.findComponent(PynOrgPendingInvitations).props('invitations')).toEqual([invitations[0]])
    w.findComponent(PynOrgPendingInvitations).vm.$emit('cancel', 'dave')
    await flushPromises()
    expect(calls).toContain('DELETE /v1/orgs/studio/invitations/dave')
  })

  it('says invited after an add that answers 202', async () => {
    stub((m, u) => (m === 'POST' ? json(invitations[0], 202) : route(m, u)))
    const w = await mountView()
    const form = w.findAll('form').at(-1)!
    await form.find('input').setValue('dave')
    await form.trigger('submit')
    await flushPromises()
    expect(w.find('[role=status]').text()).toContain('Invited dave')
  })

  it('says added after a direct add that answers 201', async () => {
    stub((m, u) => (m === 'POST' ? json({ user: 'dave', role: 'member' }, 201) : route(m, u)))
    const w = await mountView()
    const form = w.findAll('form').at(-1)!
    await form.find('input').setValue('dave')
    await form.trigger('submit')
    await flushPromises()
    expect(w.find('[role=status]').text()).toBe('Added dave.')
  })

  it('words already_invited on add', async () => {
    stub((m, u) => (m === 'POST' ? fail(409, 'already_invited') : route(m, u)))
    const w = await mountView()
    const form = w.findAll('form').at(-1)!
    await form.find('input').setValue('dave')
    await form.trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('already has a pending invitation')
  })

  it('words a cancel that finds nothing pending', async () => {
    stub((m, u) => (m === 'DELETE' ? fail(404, 'org_invitation_not_found') : route(m, u)))
    const w = await mountView()
    w.findComponent(PynOrgPendingInvitations).vm.$emit('cancel', 'dave')
    await flushPromises()
    expect(w.text()).toContain('no longer pending')
  })

  it('hides the invitations and does not fetch them for a frozen organization', async () => {
    stub(route)
    const w = await mountView(true)
    expect(w.findComponent(PynOrgPendingInvitations).exists()).toBe(false)
    expect(calls.some((c) => c.endsWith('/invitations'))).toBe(false)
  })

  it('does not fetch invitations for a plain member', async () => {
    stub(route)
    const ctx = { ...orgCtx(), org: ref({ ...orgs[0], role: 'member' as const }) }
    const w = mount(OrgMembersView, {
      global: { provide: { [sessionKey as symbol]: session, [orgKey as symbol]: ctx } },
    })
    await flushPromises()
    expect(w.findComponent(PynOrgPendingInvitations).exists()).toBe(false)
    expect(calls.some((c) => c.endsWith('/invitations'))).toBe(false)
  })
})

describe('InvitationsView', () => {
  const mountView = async () => {
    const router = makeRouter(createMemoryHistory())
    const w = mount(InvitationsView, { global: { plugins: [router] } })
    await flushPromises()
    return { w, router }
  }
  const list: Handler = (m, u) =>
    m === 'GET' && u.endsWith('/v1/me/invitations') ? json(invitations) : undefined

  it('lists my invitations', async () => {
    stub(list)
    const { w } = await mountView()
    expect(w.findComponent(PynOrgInvitations).props('invitations')).toEqual(invitations)
  })

  it('accepts and opens the organization', async () => {
    stub((m, u) => (m === 'POST' ? json(orgs[0]) : list(m, u)))
    const { w, router } = await mountView()
    w.findComponent(PynOrgInvitations).vm.$emit('accept', 'studio')
    await flushPromises()
    expect(calls).toContain('POST /v1/me/invitations/studio/accept')
    expect(router.currentRoute.value.fullPath).toBe('/studio')
  })

  it('declines and refreshes the list', async () => {
    let declined = false
    stub((m, u) => {
      if (m === 'POST') return ((declined = true), new Response(null, { status: 204 }))
      return declined ? json([invitations[1]]) : list(m, u)
    })
    const { w } = await mountView()
    w.findComponent(PynOrgInvitations).vm.$emit('decline', 'studio')
    await flushPromises()
    expect(calls).toContain('POST /v1/me/invitations/studio/decline')
    expect(w.findComponent(PynOrgInvitations).props('invitations')).toEqual([invitations[1]])
  })

  it('keeps the invitation and says why when the member limit is reached', async () => {
    stub((m, u) => (m === 'POST' ? fail(409, 'member_limit_reached') : list(m, u)))
    const { w, router } = await mountView()
    w.findComponent(PynOrgInvitations).vm.$emit('accept', 'studio')
    await flushPromises()
    expect(w.text()).toContain('member limit')
    expect(w.findComponent(PynOrgInvitations).props('invitations')).toEqual(invitations)
    expect(router.currentRoute.value.fullPath).not.toBe('/studio')
  })

  it('words a gone invitation and refreshes', async () => {
    let gone = false
    stub((m, u) => {
      if (m === 'POST') return ((gone = true), fail(404, 'org_invitation_not_found'))
      return gone ? json([invitations[1]]) : list(m, u)
    })
    const { w } = await mountView()
    w.findComponent(PynOrgInvitations).vm.$emit('accept', 'studio')
    await flushPromises()
    expect(w.text()).toContain('no longer pending')
    expect(w.findComponent(PynOrgInvitations).props('invitations')).toEqual([invitations[1]])
  })

  it('words a frozen organization on accept', async () => {
    stub((m, u) => (m === 'POST' ? fail(403, 'owner_frozen') : list(m, u)))
    const { w } = await mountView()
    w.findComponent(PynOrgInvitations).vm.$emit('accept', 'studio')
    await flushPromises()
    expect(w.text()).toContain('frozen')
  })

  it('shows a load failure', async () => {
    stub(() => fail(500, 'internal'))
    const { w } = await mountView()
    expect(w.text()).toContain('server wording')
  })
})

describe('OrgAuditView', () => {
  it('labels the invitation actions', async () => {
    const page = {
      entries: [
        {
          id: 2,
          at: '2026-10-02T09:00:00Z',
          actor: 'alice',
          action: 'org_member_invited',
          detail: 'dave',
        },
        { id: 1, at: '2026-10-01T09:00:00Z', actor: 'alice', action: 'org_unknown', detail: '' },
      ],
      next_before: null,
    }
    stub(() => json(page))
    const w = mount(OrgAuditView, {
      global: {
        provide: {
          [sessionKey as symbol]: session,
          [orgKey as symbol]: { ...orgCtx(), org: ref({ ...orgs[0], role: 'owner' as const }) },
        },
      },
    })
    await flushPromises()
    expect(w.text()).toContain('Member invited')
    expect(w.text()).toContain('org_unknown')
  })
})
