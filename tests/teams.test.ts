import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { describeError, ApiError } from '../src/api/client'
import { setRepoTeam } from '../src/api/teams'
import PynTeamDelete from '../src/components/PynTeamDelete.vue'
import PynTeamDetail from '../src/components/PynTeamDetail.vue'
import PynTeamForm from '../src/components/PynTeamForm.vue'
import PynTeamGrant from '../src/components/PynTeamGrant.vue'
import PynTeamList from '../src/components/PynTeamList.vue'
import { makeRouter } from '../src/router'
import { orgKey, repoKey, sessionKey } from '../src/state/context.state'
import {
  isEditable,
  personGrantees,
  splitRepo,
  teamCandidates,
  teamGrantees,
  teamPath,
  ungrantedTeams,
} from '../src/state/team.state'
import { orgs, repoTeams, teams } from '../src/stories/org-data'
import OrgTeamsView from '../src/views/OrgTeamsView.vue'
import OrgTeamView from '../src/views/OrgTeamView.vue'
import RepoMembersView from '../src/views/RepoMembersView.vue'

describe('team state', () => {
  it('builds team paths under /-/teams', () => {
    expect(teamPath('studio')).toBe('/studio/-/teams')
    expect(teamPath('studio', 'art team')).toBe('/studio/-/teams/art%20team')
  })

  it('lists who can be added and which teams can be granted', () => {
    expect(teamCandidates(['carol', 'alice', 'bob'], ['bob'])).toEqual(['alice', 'carol'])
    expect(ungrantedTeams(teams, repoTeams)).toEqual(['qa'])
  })

  it('maps members and teams to grantees, editable only when direct', () => {
    const people = personGrantees([
      { user: 'a', role: 'admin', source: 'org_owner' },
      { user: 'b', role: 'reader', source: 'direct' },
    ])
    expect(people.map(isEditable)).toEqual([false, true])
    expect(teamGrantees('studio', repoTeams)[0].href).toBe('/studio/-/teams/artists')
    expect(splitRepo('studio/game')).toEqual({ owner: 'studio', name: 'game' })
  })

  it('explains the team error codes', () => {
    expect(describeError(new ApiError(409, 'team_exists', 'x'))).toContain('already exists')
    expect(describeError(new ApiError(400, 'not_org_repo', 'x'))).toContain('organization')
  })
})

describe('PynTeamList', () => {
  it('links each team with counts and the created date', () => {
    const w = mount(PynTeamList, { props: { org: 'studio', teams } })
    expect(w.find('a').attributes('href')).toBe('/studio/-/teams/artists')
    expect(w.find('[data-members]').text()).toBe('2 members')
    expect(w.find('[data-repos]').text()).toBe('2 repositories')
    expect(w.text()).toContain('Sep 10 2026')
  })

  it('has an empty state', () => {
    expect(mount(PynTeamList, { props: { org: 'studio', teams: [] } }).text()).toContain('no teams')
  })
})

describe('PynTeamForm', () => {
  it('emits the slug, name and description when creating', async () => {
    const w = mount(PynTeamForm, { props: { error: 'taken' } })
    await w.find('input').setValue(' qa ')
    await w.find('textarea').setValue('testers')
    await w.find('form').trigger('submit')
    expect(w.emitted('submit')?.[0]).toEqual([{ slug: 'qa', name: '', description: 'testers' }])
    expect(w.find('[role=alert]').text()).toBe('taken')
  })

  it('starts from the team when editing and has no slug field', async () => {
    const w = mount(PynTeamForm, { props: { team: teams[0] } })
    expect(w.findAll('input')).toHaveLength(1)
    await w.find('form').trigger('submit')
    expect(w.emitted('submit')?.[0]).toEqual([
      { name: 'Artists', description: 'Texture and model work.' },
    ])
  })
})

describe('PynTeamDetail', () => {
  const props = { team: teams[0], candidates: ['alice'], owner: true }

  it('shows members and granted repositories with roles', () => {
    const w = mount(PynTeamDetail, { props })
    expect(w.find('[data-members]').text()).toContain('bob')
    const links = w.findAll('[data-repos] a').map((a) => a.attributes('href'))
    expect(links).toEqual(['/studio/game', '/studio/assets'])
    expect(w.findAll('[data-role]').map((e) => e.text())).toEqual(['writer', 'maintainer'])
  })

  it('lets an owner add from the candidates and remove', async () => {
    const w = mount(PynTeamDetail, { props })
    await w.find('select').setValue('alice')
    await w.find('form').trigger('submit')
    expect(w.emitted('add')?.[0]).toEqual(['alice'])
    await w.find('button[aria-label="Remove bob"]').trigger('click')
    expect(w.emitted('remove')?.[0]).toEqual(['bob'])
  })

  it('is read only for a plain member', () => {
    const w = mount(PynTeamDetail, { props: { ...props, owner: false } })
    expect(w.find('form').exists()).toBe(false)
    expect(w.findAll('button')).toHaveLength(0)
  })
})

describe('PynTeamDelete', () => {
  it('enables deletion only once the slug is typed', async () => {
    const w = mount(PynTeamDelete, { props: { slug: 'qa' } })
    const button = w.find('button')
    expect(button.attributes('disabled')).toBeDefined()
    await w.find('input').setValue('qa')
    expect(button.attributes('disabled')).toBeUndefined()
    await w.find('form').trigger('submit')
    expect(w.emitted('remove')).toHaveLength(1)
  })
})

describe('PynTeamGrant', () => {
  it('emits the chosen team and role', async () => {
    const w = mount(PynTeamGrant, {
      props: { teams: ['qa', 'artists'], roles: ['reader', 'writer'] },
    })
    const [team, role] = w.findAll('select')
    await team.setValue('artists')
    await role.setValue('writer')
    await w.find('form').trigger('submit')
    expect(w.emitted('grant')?.[0]).toEqual([{ name: 'artists', role: 'writer' }])
  })

  it('says so when every team has a role', () => {
    const w = mount(PynTeamGrant, { props: { teams: [], roles: ['reader'] } })
    expect(w.find('button').exists()).toBe(false)
    expect(w.text()).toContain('already has a role')
  })
})

describe('team views', () => {
  afterEach(() => vi.unstubAllGlobals())

  const session = { user: ref('alice'), admin: ref(false), expire: () => {} }
  const orgCtx = (role: 'owner' | 'member') => ({
    name: computed(() => 'studio'),
    org: ref({ ...orgs[0], role }),
    reload: async () => {},
  })
  const json = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }))

  function stub(extra: (key: string) => Promise<Response> | undefined = () => undefined) {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        const key = `${init?.method ?? 'GET'} ${url}`
        calls.push(key)
        return (
          extra(key) ?? (url.endsWith('/teams') && key.startsWith('GET') ? json(teams) : json([]))
        )
      }),
    )
    return calls
  }

  it('lists the teams and offers creation to owners only', async () => {
    stub()
    const mountAs = (role: 'owner' | 'member') =>
      mount(OrgTeamsView, {
        global: { provide: { [sessionKey as symbol]: session, [orgKey as symbol]: orgCtx(role) } },
      })
    const owner = mountAs('owner')
    await flushPromises()
    expect(owner.text()).toContain('Artists')
    expect(owner.text()).toContain('Create a team')
    const member = mountAs('member')
    await flushPromises()
    expect(member.text()).not.toContain('Create a team')
  })

  it('creates a team and goes to it', async () => {
    const calls = stub((k) =>
      k === 'POST /v1/orgs/studio/teams' ? json(teams[1], 201) : undefined,
    )
    const router = makeRouter(createMemoryHistory())
    const w = mount(OrgTeamsView, {
      global: {
        plugins: [router],
        provide: { [sessionKey as symbol]: session, [orgKey as symbol]: orgCtx('owner') },
      },
    })
    await flushPromises()
    await w.find('input').setValue('qa')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(calls).toContain('POST /v1/orgs/studio/teams')
    expect(router.currentRoute.value.path).toBe('/studio/-/teams/qa')
  })

  it('loads a team, adds a member from the organization and deletes with confirmation', async () => {
    const calls = stub((k) => {
      if (k === 'GET /v1/orgs/studio/teams/artists') return json(teams[0])
      if (k.startsWith('GET /v1/orgs/studio/teams/'))
        return json({ code: 'team_not_found', message: 'm' }, 404)
      if (k === 'GET /v1/orgs/studio/members')
        return json([
          { user: 'alice', role: 'owner' },
          { user: 'bob', role: 'member' },
        ])
      if (k.startsWith('PUT') || k.startsWith('DELETE'))
        return Promise.resolve(new Response(null, { status: 204 }))
      return undefined
    })
    const router = makeRouter(createMemoryHistory())
    await router.push('/studio/-/teams/artists')
    const w = mount(OrgTeamView, {
      global: {
        plugins: [router],
        provide: { [sessionKey as symbol]: session, [orgKey as symbol]: orgCtx('owner') },
      },
    })
    await flushPromises()
    expect(w.text()).toContain('Texture and model work.')
    const detail = w.findComponent(PynTeamDetail)
    const select = detail.find('select')
    expect(select.findAll('option').map((o) => o.text())).toEqual(['Choose a member', 'alice'])
    await select.setValue('alice')
    await detail.find('form').trigger('submit')
    await flushPromises()
    expect(calls).toContain('PUT /v1/orgs/studio/teams/artists/members/alice')

    const del = w.findAllComponents(PynTeamDelete)[0]
    await del.find('input').setValue('artists')
    await del.find('form').trigger('submit')
    await flushPromises()
    expect(calls).toContain('DELETE /v1/orgs/studio/teams/artists')
    expect(router.currentRoute.value.path).toBe('/studio/-/teams')
  })

  it('shows not found for an unknown team', async () => {
    stub((k) =>
      k.startsWith('GET /v1/orgs/studio/teams/')
        ? json({ code: 'team_not_found', message: 'm' }, 404)
        : undefined,
    )
    const router = makeRouter(createMemoryHistory())
    await router.push('/studio/-/teams/nope')
    const w = mount(OrgTeamView, {
      global: {
        plugins: [router],
        provide: { [sessionKey as symbol]: session, [orgKey as symbol]: orgCtx('member') },
      },
    })
    await flushPromises()
    expect(w.text()).not.toContain('Members')
  })

  describe('repository members', () => {
    const repoCtx = (orgOwned: boolean) => ({
      target: computed(() => ({ owner: 'studio', name: 'game' })),
      repo: ref(null),
      permissions: ref(['read', 'manage_users']),
      org: ref(orgOwned ? orgs[0] : null),
      reload: async () => {},
    })
    const routes = (k: string) => {
      if (k === 'GET /v1/repos/studio/game/members')
        return json([
          { user: 'alice', role: 'admin', source: 'org_owner' },
          { user: 'bob', role: 'reader', source: 'direct' },
        ])
      if (k === 'GET /v1/repos/studio/game/roles')
        return json([
          { role: 'reader', permissions: [] },
          { role: 'writer', permissions: [] },
        ])
      if (k === 'GET /v1/repos/studio/game/teams') return json(repoTeams)
      if (k === 'GET /v1/orgs/studio/teams') return json(teams)
      if (k.startsWith('PUT') || k.startsWith('DELETE'))
        return Promise.resolve(new Response(null, { status: 204 }))
      return undefined
    }
    const mountView = (orgOwned: boolean) =>
      mount(RepoMembersView, {
        global: {
          provide: { [sessionKey as symbol]: session, [repoKey as symbol]: repoCtx(orgOwned) },
        },
      })

    it('shows sources and the team section, and grants and revokes', async () => {
      const calls = stub(routes)
      const w = mountView(true)
      await flushPromises()
      expect(w.text()).toContain('Comes from owning the organization')
      expect(calls).toContain('GET /v1/repos/studio/game/teams')
      const grant = w.findComponent(PynTeamGrant)
      expect(
        grant
          .find('select')
          .findAll('option')
          .map((o) => o.text()),
      ).toEqual(['qa'])
      await grant.find('form').trigger('submit')
      await flushPromises()
      expect(calls).toContain('PUT /v1/repos/studio/game/teams/qa')
      await w.find('button[aria-label="Revoke artists"]').trigger('click')
      await flushPromises()
      expect(calls).toContain('DELETE /v1/repos/studio/game/teams/artists')
    })

    it('has no team section for a user-owned repository', async () => {
      const calls = stub(routes)
      const w = mountView(false)
      await flushPromises()
      expect(w.text()).not.toContain('Grant a team')
      expect(calls.some((c) => c.includes('/teams'))).toBe(false)
    })

    it('shows the server refusal next to the grant form', async () => {
      stub((k) =>
        k === 'PUT /v1/repos/studio/game/teams/qa'
          ? json({ code: 'forbidden', message: 'missing permission' }, 403)
          : routes(k),
      )
      const w = mountView(true)
      await flushPromises()
      await w.findComponent(PynTeamGrant).find('form').trigger('submit')
      await flushPromises()
      expect(w.findComponent(PynTeamGrant).find('[role=alert]').text()).toBe('missing permission')
    })
  })
})

describe('team api', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('puts the role to the encoded repository team path', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))
    vi.stubGlobal('fetch', fetchMock)
    await setRepoTeam({ owner: 'studio', name: 'game' }, 'qa', 'writer')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/v1/repos/studio/game/teams/qa')
    expect(init.method).toBe('PUT')
    expect(init.body).toBe('{"role":"writer"}')
  })
})
