import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { describeError, ApiError } from '../src/api/client'
import PynOrgDelete from '../src/components/PynOrgDelete.vue'
import PynOrgForm from '../src/components/PynOrgForm.vue'
import PynOrgHeader from '../src/components/PynOrgHeader.vue'
import PynOrgList from '../src/components/PynOrgList.vue'
import PynOrgRepoPolicy from '../src/components/PynOrgRepoPolicy.vue'
import PynOrgMembers from '../src/components/PynOrgMembers.vue'
import PynRepoForm from '../src/components/PynRepoForm.vue'
import PynRepoHeader from '../src/components/PynRepoHeader.vue'
import PynSideNav from '../src/components/PynSideNav.vue'
import PynTopBar from '../src/components/PynTopBar.vue'
import { makeRouter } from '../src/router'
import { orgKey, sessionKey } from '../src/state/context.state'
import { orgPath, orgTabs, ownerChoices, ruleSubjects } from '../src/state/org.state'
import { mainNav } from '../src/state/shell.state'
import { orgMembers, orgs, repoPolicy, teams } from '../src/stories/org-data'
import { sampleRepos } from '../src/stories/shell-data'
import OrgMembersView from '../src/views/OrgMembersView.vue'
import OrgSettingsView from '../src/views/OrgSettingsView.vue'

const resolve = (path: string) => makeRouter(createMemoryHistory()).resolve(path)

describe('router', () => {
  it('keeps /_/ pages, repositories and org sub-pages apart from /:owner', () => {
    expect(resolve('/_/new-org').name).toBe('new-org')
    expect(resolve('/_/orgs').name).toBe('orgs')
    expect(resolve('/_/new').name).toBe('new-repo')
    expect(resolve('/studio').name).toBe('owner')
    expect(resolve('/studio/-/members').name).toBe('org-members')
    expect(resolve('/studio/-/teams').name).toBe('org-teams')
    expect(resolve('/studio/-/teams/artists').name).toBe('org-team')
    expect(resolve('/studio/-/settings').name).toBe('org-settings')
    expect(resolve('/studio/-/audit').name).toBe('org-audit')
    expect(resolve('/studio/game').name).toBe('files')
    expect(resolve('/studio/game/members').name).toBe('members')
    expect(resolve('/studio/game/settings').name).toBe('settings')
  })

  it('sends /:owner/- to the profile', async () => {
    const router = makeRouter(createMemoryHistory())
    await router.push('/studio/-')
    expect(router.currentRoute.value.name).toBe('owner')
  })
})

describe('org state', () => {
  it('builds org paths under /-/', () => {
    expect(orgPath('studio')).toBe('/studio')
    expect(orgPath('studio', 'members')).toBe('/studio/-/members')
  })

  it('shows tabs by role', () => {
    const sections = (r: Parameters<typeof orgTabs>[0]) => orgTabs(r).map((t) => t.section)
    expect(sections(null)).toEqual([''])
    expect(sections('member')).toEqual(['', 'members', 'teams'])
    expect(sections('owner')).toEqual(['', 'members', 'teams', 'audit', 'settings'])
  })

  it('offers yourself and every organization you belong to', () => {
    expect(ownerChoices('alice', orgs)).toEqual(['alice', 'modding-club', 'studio'])
    expect(ownerChoices('alice', [{ name: 'x', created_at: '' }])).toEqual(['alice'])
  })

  it('limits rule subjects and never offers denying owners', () => {
    expect(ruleSubjects('role', 'deny', [], [])).toEqual(['member'])
    expect(ruleSubjects('role', 'allow', [], [])).toEqual(['member', 'owner'])
    expect(ruleSubjects('team', 'allow', ['qa'], ['bob'])).toEqual(['qa'])
    expect(ruleSubjects('user', 'deny', ['qa'], ['bob'])).toEqual(['bob'])
  })

  it('keeps the server message for a forbidden creation and explains a missing rule', () => {
    const msg = 'Members may not create public repositories in studio.'
    expect(describeError(new ApiError(403, 'repo_create_forbidden', msg))).toBe(msg)
    expect(describeError(new ApiError(404, 'creation_rule_not_found', 'x'))).toContain('rule')
  })

  it('explains the last-owner error', () => {
    const e = new ApiError(409, 'last_org_owner', 'x')
    expect(describeError(e)).toContain('at least one owner')
  })
})

describe('PynOrgForm', () => {
  it('emits the trimmed name and shows an error', async () => {
    const w = mount(PynOrgForm, { props: { error: 'taken' } })
    await w.find('input').setValue(' studio ')
    await w.find('form').trigger('submit')
    expect(w.emitted('submit')?.[0]).toEqual(['studio'])
    expect(w.find('[role=alert]').text()).toBe('taken')
  })
})

describe('PynOrgList', () => {
  it('links each organization with its role and date', () => {
    const w = mount(PynOrgList, { props: { orgs } })
    expect(w.find('a').attributes('href')).toBe('/studio')
    expect(w.find('[data-role]').text()).toBe('owner')
    expect(w.text()).toContain('Sep 02 2026')
  })

  it('offers to create one when empty', () => {
    expect(
      mount(PynOrgList, { props: { orgs: [] } })
        .find('a')
        .attributes('href'),
    ).toBe('/_/new-org')
  })
})

describe('PynOrgHeader', () => {
  it('marks the organization and links only the tabs the role allows', () => {
    const w = mount(PynOrgHeader, {
      props: { name: 'studio', createdAt: '2026-09-02T08:00:00Z', role: 'member' },
    })
    expect(w.find('[data-kind]').text()).toBe('organization')
    expect(w.findAll('nav a').map((a) => a.attributes('href'))).toEqual([
      '/studio',
      '/studio/-/members',
      '/studio/-/teams',
    ])
  })
})

describe('PynOrgMembers', () => {
  const props = { members: orgMembers, self: 'alice', owner: true }
  const buttons = (w: ReturnType<typeof mount>, text: string) =>
    w.findAll('button').filter((b) => b.text().startsWith(text))

  it('lets an owner add a member with a role', async () => {
    const w = mount(PynOrgMembers, { props })
    const form = w.findAll('form').at(-1)!
    await form.find('input').setValue(' dave ')
    await form.find('select').setValue('owner')
    await form.trigger('submit')
    expect(w.emitted('add')?.[0]).toEqual([{ user: 'dave', role: 'owner' }])
  })

  it('emits a role change', async () => {
    const w = mount(PynOrgMembers, { props })
    await w.find('select[aria-label="Role of bob"]').setValue('owner')
    expect(w.emitted('setRole')?.[0]).toEqual([{ user: 'bob', role: 'owner' }])
  })

  it('confirms before removing and before leaving', async () => {
    const w = mount(PynOrgMembers, { props })
    await buttons(w, 'Remove')[0].trigger('click')
    expect(w.emitted('remove')).toBeUndefined()
    await w.find('form').trigger('submit')
    expect(w.emitted('remove')?.[0]).toEqual(['bob'])
  })

  it('gives a plain member only a Leave button on their own row', () => {
    const w = mount(PynOrgMembers, { props: { ...props, self: 'bob', owner: false } })
    expect(w.findAll('select')).toHaveLength(0)
    expect(w.findAll('button').map((b) => b.text())).toEqual(['Leave'])
    expect(w.text()).not.toContain('Add an existing account')
  })

  it('shows the server error', () => {
    const w = mount(PynOrgMembers, { props: { ...props, error: 'last owner' } })
    expect(w.find('[role=alert]').text()).toBe('last owner')
  })
})

describe('PynOrgDelete', () => {
  it('enables deletion only once the name is typed', async () => {
    const w = mount(PynOrgDelete, { props: { name: 'studio' } })
    const button = w.find('button')
    expect(button.attributes('disabled')).toBeDefined()
    await w.find('input').setValue('studio')
    expect(button.attributes('disabled')).toBeUndefined()
    await w.find('form').trigger('submit')
    expect(w.emitted('remove')).toHaveLength(1)
  })
})

describe('owner picker and headers', () => {
  it('hides the picker without a choice and emits the picked owner', async () => {
    const solo = mount(PynRepoForm, { props: { owner: 'alice', owners: ['alice'] } })
    expect(solo.findAll('select')).toHaveLength(1)
    const w = mount(PynRepoForm, { props: { owner: 'alice', owners: ['alice', 'studio'] } })
    await w.findAll('select')[0].setValue('studio')
    expect(w.findAll('select')).toHaveLength(2)
    expect(w.emitted('update:owner')?.[0]).toEqual(['studio'])
  })

  it('shows the organization chip on a repository header', () => {
    const base = { owner: 'studio', name: 'game', visibility: 'private' as const, leaseHours: 8 }
    const org = mount(PynRepoHeader, { props: { ...base, orgOwned: true } })
    expect(org.find('[data-org]').exists()).toBe(true)
    expect(org.find('a[href="/studio"]').exists()).toBe(true)
    expect(mount(PynRepoHeader, { props: base }).find('[data-org]').exists()).toBe(false)
  })

  it('lists organizations in the sidebar and the create menu', async () => {
    const side = mount(PynSideNav, {
      props: { account: 'alice', items: mainNav, current: '', repos: sampleRepos, orgs },
    })
    expect(side.find('a[href="/studio"]').exists()).toBe(true)
    const bar = mount(PynTopBar, { props: { user: 'alice', repos: [], theme: 'system' } })
    await bar.find('[aria-label="Create"]').trigger('click')
    expect(bar.find('a[href="/_/new-org"]').exists()).toBe(true)
  })
})

describe('OrgMembersView', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads members and surfaces the last-owner error on remove', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? 'GET'} ${url}`)
        if (init?.method === 'DELETE')
          return Promise.resolve(
            new Response(JSON.stringify({ code: 'last_org_owner', message: 'm' }), { status: 409 }),
          )
        return Promise.resolve(new Response(JSON.stringify(orgMembers)))
      }),
    )
    const w = mount(OrgMembersView, {
      global: {
        provide: {
          [sessionKey as symbol]: { user: ref('alice'), admin: ref(false), expire: () => {} },
          [orgKey as symbol]: {
            name: computed(() => 'studio'),
            org: ref(orgs[0]),
            reload: async () => {},
          },
        },
      },
    })
    await flushPromises()
    expect(calls).toContain('GET /v1/orgs/studio/members')
    await w
      .findAll('button')
      .find((b) => b.text() === 'Leave')!
      .trigger('click')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(calls).toContain('DELETE /v1/orgs/studio/members/alice')
    expect(w.text()).toContain('at least one owner')
  })
})

describe('PynOrgRepoPolicy', () => {
  const props = { policy: repoPolicy, teams: teams.map((t) => t.slug), members: ['bob', 'carol'] }

  it('lists rules with effect, kind, subject and scope', () => {
    const w = mount(PynOrgRepoPolicy, { props })
    expect(w.findAll('li')).toHaveLength(3)
    expect(w.findAll('li')[1].text()).toContain('deny')
    expect(w.findAll('li')[1].text()).toContain('carol')
    expect(
      (w.find('select[aria-label="Scope of deny user carol"]').element as HTMLSelectElement).value,
    ).toBe('public')
  })

  it('emits the base setting, a scope change and a removal', async () => {
    const w = mount(PynOrgRepoPolicy, { props })
    await w.find('select').setValue('both')
    expect(w.emitted('setBase')?.[0]).toEqual(['both'])
    await w.find('select[aria-label="Scope of deny user carol"]').setValue('both')
    expect(w.emitted('setRule')?.[0]).toEqual([
      { rule: { effect: 'deny', kind: 'user', subject: 'carol', scope: 'public' }, scope: 'both' },
    ])
    await w.find('button[aria-label="Remove deny user carol"]').trigger('click')
    expect(w.emitted('removeRule')?.[0]).toEqual([
      { effect: 'deny', kind: 'user', subject: 'carol', scope: 'public' },
    ])
  })

  it('adds a rule from the form and hides owner for deny', async () => {
    const w = mount(PynOrgRepoPolicy, { props })
    const form = w.find('form')
    const [effect, kind, subject, scope] = form.findAll('select')
    await kind.setValue('user')
    await subject.setValue('bob')
    await scope.setValue('private')
    await form.trigger('submit')
    expect(w.emitted('setRule')?.[0]).toEqual([
      { rule: { effect: 'allow', kind: 'user', subject: 'bob' }, scope: 'private' },
    ])
    await effect.setValue('deny')
    await kind.setValue('role')
    expect(subject.findAll('option').map((o) => o.text())).toEqual(['Choose a role', 'member'])
  })

  it('shows the error', () => {
    const w = mount(PynOrgRepoPolicy, { props: { ...props, error: 'nope' } })
    expect(w.find('[role=alert]').text()).toBe('nope')
  })
})

describe('OrgSettingsView', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads the policy for owners and saves the base setting', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? 'GET'} ${url}`)
        if (url.endsWith('/repo-policy'))
          return Promise.resolve(new Response(JSON.stringify(repoPolicy)))
        return Promise.resolve(new Response(JSON.stringify([])))
      }),
    )
    const w = mount(OrgSettingsView, {
      global: {
        provide: {
          [sessionKey as symbol]: { user: ref('alice'), admin: ref(false), expire: () => {} },
          [orgKey as symbol]: {
            name: computed(() => 'studio'),
            org: ref(orgs[0]),
            reload: async () => {},
          },
        },
      },
    })
    await flushPromises()
    expect(calls).toContain('GET /v1/orgs/studio/repo-policy')
    await w.find('select').setValue('both')
    await flushPromises()
    expect(calls).toContain('PUT /v1/orgs/studio/repo-policy')
  })
})
