import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { ApiError, describeError } from '../src/api/client'
import { createRepo, fetchFiles, setMember, updateRepo } from '../src/api/repos'
import PynAudit from '../src/components/PynAudit.vue'
import PynHistory from '../src/components/PynHistory.vue'
import PynInvites from '../src/components/PynInvites.vue'
import PynLocks from '../src/components/PynLocks.vue'
import PynMembers from '../src/components/PynMembers.vue'
import PynRepoDelete from '../src/components/PynRepoDelete.vue'
import PynRepoForm from '../src/components/PynRepoForm.vue'
import PynRepoList from '../src/components/PynRepoList.vue'
import PynRepoNav from '../src/components/PynRepoNav.vue'
import PynRepoNotFound from '../src/components/PynRepoNotFound.vue'
import PynRoles from '../src/components/PynRoles.vue'
import RepoBlobView from '../src/views/RepoBlobView.vue'
import RepoHistoryView from '../src/views/RepoHistoryView.vue'
import { repoKey, sessionKey } from '../src/state/context.state'
import { internalPath } from '../src/state/links.state'
import { parseLockLimit, repoPath, repoTabs, sortRepos } from '../src/state/repo.state'
import { makeRouter } from '../src/router'

const now = new Date('2026-10-08T12:00:00Z')
const repo = (owner: string, name: string, role?: string) => ({
  owner,
  name,
  visibility: 'private' as const,
  lease_hours: 8,
  max_locks_per_user: 10,
  max_locks_set_by_policy: false,
  created_at: '2026-10-01T09:00:00Z',
  role,
})

describe('repo state', () => {
  it('builds app paths and encodes segments', () => {
    expect(repoPath({ owner: 'alice', name: 'game' })).toBe('/alice/game')
    expect(repoPath({ owner: 'alice', name: 'game' }, 'locks')).toBe('/alice/game/locks')
    expect(repoPath({ owner: 'a', name: 'b.c' })).toBe('/a/b.c')
  })

  it('shows only the tabs the permissions allow', () => {
    const labels = (p: string[], owner: boolean) => repoTabs(p, owner).map((t) => t.label)
    expect(labels(['read'], false)).toEqual(['Code', 'Locks', 'History'])
    expect(labels(['read', 'view_audit', 'manage_users', 'manage_roles'], false)).toEqual([
      'Code',
      'Locks',
      'History',
      'Audit',
      'Members',
      'Roles',
      'Invites',
    ])
    expect(labels(['read', 'manage_roles'], true)).toContain('Settings')
    expect(labels(['read', 'manage_roles'], false)).not.toContain('Settings')
  })

  it('sorts repositories by owner then name', () => {
    expect(
      sortRepos([repo('bob', 'a'), repo('alice', 'z'), repo('alice', 'b')]).map((r) => r.name),
    ).toEqual(['b', 'z', 'a'])
  })
})

describe('router', () => {
  const resolve = (path: string) => makeRouter(createMemoryHistory()).resolve(path)

  it('routes repository pages under /:owner/:name', () => {
    expect(resolve('/alice/game').name).toBe('files')
    expect(resolve('/alice/game/locks').name).toBe('locks')
    expect(resolve('/alice/game/settings').params).toMatchObject({ owner: 'alice', name: 'game' })
  })

  it('keeps account pages out of the repository namespace', () => {
    expect(resolve('/_/new').name).toBe('new-repo')
    expect(resolve('/_/keys').name).toBe('keys')
    expect(resolve('/_/settings/keys').name).toBe('keys')
    expect(resolve('/').name).toBe('repos')
  })
})

describe('internalPath', () => {
  const click = (href: string, init: MouseEventInit = {}) => {
    const a = document.createElement('a')
    a.href = href
    const e = new MouseEvent('click', { button: 0, ...init })
    Object.defineProperty(e, 'target', { value: a })
    return e
  }

  it('returns same-origin paths for plain clicks only', () => {
    const o = window.location.origin
    expect(internalPath(click(`${o}/alice/game?x=1`), o)).toBe('/alice/game?x=1')
    expect(internalPath(click(`${o}/alice/game#L2-L4`), o)).toBe('/alice/game#L2-L4')
    expect(internalPath(click(`${o}/alice/game`, { ctrlKey: true }), o)).toBeNull()
    expect(internalPath(click('https://example.com/x'), o)).toBeNull()
  })
})

describe('error text', () => {
  it('explains the repository error codes', () => {
    expect(describeError(new ApiError(404, 'repo_not_found', 'x'))).toContain('no role')
    expect(describeError(new ApiError(409, 'repo_exists', 'x'))).toContain('already exists')
    expect(describeError(new ApiError(400, 'invalid_repo_name', 'x'))).toContain('lowercase')
    expect(describeError(new ApiError(403, 'not_namespace_owner', 'x'))).toContain('owner')
    expect(describeError(new ApiError(409, 'lock_held', 'held by bob'))).toBe('held by bob')
  })
})

describe('repository api', () => {
  afterEach(() => vi.unstubAllGlobals())

  const stub = (...bodies: unknown[]) => {
    const fn = vi.fn()
    for (const b of bodies) fn.mockResolvedValueOnce({ ok: true, status: 200, json: async () => b })
    vi.stubGlobal('fetch', fn)
    return fn
  }

  it('scopes file listing to the repository and follows pages', async () => {
    const fn = stub(
      { entries: [{ path: 'a', mode: 'shared' }], next_after: 'a' },
      { entries: [{ path: 'b', mode: 'shared' }], next_after: null },
    )
    const rows = await fetchFiles({ owner: 'alice', name: 'game' })
    expect(rows.map((r) => r.path)).toEqual(['a', 'b'])
    expect(fn.mock.calls[0][0]).toBe('/v1/repos/alice/game/files')
    expect(fn.mock.calls[1][0]).toBe('/v1/repos/alice/game/files?after=a')
  })

  it('creates with the owner and patches only what is sent', async () => {
    const fn = stub(repo('alice', 'game'), repo('alice', 'g2'))
    await createRepo('alice', { name: 'game', visibility: 'private', lease_hours: 8 })
    await updateRepo({ owner: 'alice', name: 'game' }, { name: 'g2' })
    expect(fn.mock.calls[0][0]).toBe('/v1/repos')
    expect(JSON.parse(fn.mock.calls[0][1].body)).toEqual({
      owner: 'alice',
      name: 'game',
      visibility: 'private',
      lease_hours: 8,
    })
    expect(fn.mock.calls[1][1].method).toBe('PATCH')
    expect(JSON.parse(fn.mock.calls[1][1].body)).toEqual({ name: 'g2' })
  })

  it('sends the lock limit on create, omits it when empty, and null clears it on patch', async () => {
    const fn = stub(repo('alice', 'a'), repo('alice', 'b'), repo('alice', 'b'))
    const s = { name: 'a', visibility: 'private' as const, lease_hours: 8 }
    await createRepo('alice', { ...s, max_locks_per_user: 4 })
    await createRepo('alice', { ...s, max_locks_per_user: null })
    await updateRepo({ owner: 'alice', name: 'b' }, { max_locks_per_user: null })
    expect(JSON.parse(fn.mock.calls[0][1].body).max_locks_per_user).toBe(4)
    expect(JSON.parse(fn.mock.calls[1][1].body)).not.toHaveProperty('max_locks_per_user')
    expect(JSON.parse(fn.mock.calls[2][1].body)).toEqual({ max_locks_per_user: null })
  })

  it('encodes path segments', async () => {
    const fn = stub({})
    fn.mockResolvedValueOnce({ ok: true, status: 204 })
    await setMember({ owner: 'a', name: 'b.c' }, 'x y', 'reader')
    expect(fn.mock.calls[0][0]).toBe('/v1/repos/a/b.c/members/x%20y')
  })

  it('turns a repo_not_found body into an ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ code: 'repo_not_found', message: 'nope' }),
      }),
    )
    await expect(fetchFiles({ owner: 'x', name: 'y' })).rejects.toMatchObject({
      status: 404,
      code: 'repo_not_found',
    })
  })
})

describe('PynRepoList', () => {
  it('lists owner, name, visibility and role with a link to the repository', () => {
    const w = mount(PynRepoList, { props: { repos: [repo('alice', 'game', 'admin')] } })
    expect(w.text()).toContain('alice/game')
    expect(w.text()).toContain('private')
    expect(w.find('[data-role]').text()).toBe('admin')
    expect(w.find('a').attributes('href')).toBe('/alice/game')
  })

  it('offers to create one when empty', () => {
    const w = mount(PynRepoList, { props: { repos: [] } })
    expect(w.find('a').attributes('href')).toBe('/_/new')
  })
})

describe('PynRepoForm', () => {
  it('emits the settings to create', async () => {
    const w = mount(PynRepoForm, { props: { owner: 'alice' } })
    await w.find('input').setValue(' game ')
    await w.find('select').setValue('public')
    await w.find('input[type=number]').setValue('24')
    await w.find('form').trigger('submit')
    expect(w.emitted('submit')?.[0]).toEqual([
      { name: 'game', visibility: 'public', lease_hours: 24 },
    ])
  })

  it('starts from the existing settings when editing', () => {
    const w = mount(PynRepoForm, {
      props: { owner: 'alice', repo: { name: 'game', visibility: 'public', lease_hours: 12 } },
    })
    expect((w.find('input').element as HTMLInputElement).value).toBe('game')
    expect(w.find('button').text()).toBe('Save changes')
  })
})

describe('PynRepoForm lock limit', () => {
  const base = { name: 'game', visibility: 'public' as const, lease_hours: 12 }
  const mountEdit = (extra: object, effective = 10) =>
    mount(PynRepoForm, {
      props: { owner: 'alice', repo: { ...base, ...extra }, effectiveMaxLocks: effective },
    })
  const limit = (w: ReturnType<typeof mount>) => w.findAll('input[type=number]')[1]

  it('emits the typed limit on create and nothing when empty', async () => {
    const w = mount(PynRepoForm, { props: { owner: 'alice' } })
    await w.find('input').setValue('game')
    await limit(w).setValue('5')
    await w.find('form').trigger('submit')
    expect(w.emitted('submit')?.[0][0]).toMatchObject({ max_locks_per_user: 5 })
    await limit(w).setValue('')
    await w.find('form').trigger('submit')
    expect(w.emitted('submit')?.[1][0]).not.toHaveProperty('max_locks_per_user')
  })

  it('shows the stored setting and clears it with null when emptied', async () => {
    const w = mountEdit({ max_locks_per_user_setting: 5 }, 5)
    expect((limit(w).element as HTMLInputElement).value).toBe('5')
    await limit(w).setValue('')
    await w.find('form').trigger('submit')
    expect(w.emitted('submit')?.[0][0]).toMatchObject({ max_locks_per_user: null })
    expect(limit(w).attributes('placeholder')).toBe('Server default (5)')
  })

  it('is read-only with a note and sends no limit while the policy file sets it', async () => {
    const w = mountEdit({ max_locks_per_user_setting: 5, max_locks_set_by_policy: true }, 3)
    expect((limit(w).element as HTMLInputElement).value).toBe('3')
    expect(limit(w).attributes('readonly')).toBeDefined()
    expect(w.text()).toContain('.pyn/pyn.toml')
    await w.find('form').trigger('submit')
    expect(w.emitted('submit')?.[0][0]).not.toHaveProperty('max_locks_per_user')
  })
})

describe('parseLockLimit', () => {
  it('reads whole numbers, empty as null and junk as NaN', () => {
    expect(parseLockLimit('7')).toBe(7)
    expect(parseLockLimit('')).toBeNull()
    expect(parseLockLimit(null)).toBeNull()
    expect(parseLockLimit('1.5')).toBeNaN()
  })
})

describe('PynRepoDelete', () => {
  it('stays disabled until the full name is typed', async () => {
    const w = mount(PynRepoDelete, { props: { slug: 'alice/game' } })
    expect(w.find('button').attributes('disabled')).toBeDefined()
    await w.find('input').setValue('alice/game')
    expect(w.find('button').attributes('disabled')).toBeUndefined()
    await w.find('form').trigger('submit')
    expect(w.emitted('remove')).toHaveLength(1)
  })
})

describe('PynRepoNav and PynRepoNotFound', () => {
  it('marks the current tab', () => {
    const w = mount(PynRepoNav, {
      props: { owner: 'alice', name: 'game', tabs: repoTabs(['read'], false), current: 'locks' },
    })
    expect(w.find('[aria-current=page]').text()).toBe('Locks')
    expect(w.findAll('a')[0].attributes('href')).toBe('/alice/game')
  })

  it('does not reveal whether the repository exists', () => {
    const w = mount(PynRepoNotFound, { props: { slug: 'bob/secret' } })
    expect(w.text()).toContain('bob/secret')
    expect(w.text()).toContain('no role')
  })
})

describe('PynLocks', () => {
  const locks = [
    { path: 'a.umap', owner: 'bob', acquired_at: '', expires_at: '2026-10-08T15:00:00Z' },
  ]

  it('hides force unlock without the permission', () => {
    const w = mount(PynLocks, { props: { locks, now } })
    expect(w.text()).toContain('bob')
    expect(w.text()).toContain('3h 0m')
    expect(w.text()).not.toContain('Force unlock')
  })

  it('asks for a reason before emitting', async () => {
    const w = mount(PynLocks, { props: { locks, now, canForce: true } })
    await w.find('button').trigger('click')
    await w.find('input').setValue('  left the studio ')
    await w.find('form').trigger('submit')
    expect(w.emitted('forceUnlock')?.[0]).toEqual([{ path: 'a.umap', reason: 'left the studio' }])
  })
})

describe('PynHistory', () => {
  const rev = (id: number, path = 'a.ts', restored_from?: number) => ({
    id,
    path,
    author: 'alice',
    message: `m${id}`,
    created_at: '2026-10-08T11:00:00Z',
    restored_from,
  })

  it('shows revision, path, author and message', () => {
    const w = mount(PynHistory, { props: { revisions: [rev(3, 'x/y.ts', 1)] } })
    expect(w.text()).toContain('r3')
    expect(w.text()).toContain('x/y.ts')
    expect(w.text()).toContain('alice')
    expect(w.text()).toContain('m3')
    expect(w.text()).toContain('restored from r1')
  })

  it('has loading and empty states and an inline error', () => {
    expect(mount(PynHistory, { props: { revisions: [], loading: true } }).text()).toContain(
      'Loading history',
    )
    expect(mount(PynHistory, { props: { revisions: [] } }).text()).toContain('No revisions yet')
    const w = mount(PynHistory, { props: { revisions: [], error: 'bad glob', filter: '[' } })
    expect(w.find('[role=alert]').text()).toBe('bad glob')
  })

  it('debounces the filter and emits load-more', async () => {
    vi.useFakeTimers()
    const w = mount(PynHistory, { props: { revisions: [rev(1)], hasMore: true } })
    await w.find('input').setValue(' *.ts ')
    await w.find('input').setValue(' *.uasset ')
    expect(w.emitted('filter')).toBeUndefined()
    vi.advanceTimersByTime(400)
    expect(w.emitted('filter')).toEqual([['*.uasset']])
    vi.useRealTimers()
    await w.find('button').trigger('click')
    expect(w.emitted('more')).toHaveLength(1)
  })

  it('shows a per-file scope instead of the filter box', async () => {
    const w = mount(PynHistory, { props: { revisions: [rev(1)], path: 'a.ts' } })
    expect(w.find('input').exists()).toBe(false)
    await w.find('button').trigger('click')
    expect(w.emitted('clearPath')).toHaveLength(1)
  })
})

describe('history view', () => {
  const page = (ids: number[], next: string | null) => ({
    revisions: ids.map((id) => ({
      id,
      path: 'a.ts',
      author: 'alice',
      message: `m${id}`,
      created_at: '2026-10-08T11:00:00Z',
    })),
    next_cursor: next,
  })
  const reply = (body: unknown, status = 200) =>
    ({ ok: status < 400, status, json: async () => body }) as Response

  async function mountView(fn: ReturnType<typeof vi.fn>, url = '/alice/game/history') {
    vi.stubGlobal('fetch', fn)
    const router = makeRouter(createMemoryHistory())
    await router.push(url)
    const w = mount(RepoHistoryView, {
      global: {
        plugins: [router],
        provide: { [repoKey as symbol]: { target: ref({ owner: 'alice', name: 'game' }) } },
      },
    })
    await flushPromises()
    return { w, router }
  }

  it('loads repository history on open and appends on load more', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(reply(page([3, 2], 'c1')))
      .mockResolvedValueOnce(reply(page([1], null)))
    const { w } = await mountView(fn)
    expect(fn.mock.calls[0][0]).toBe('/v1/repos/alice/game/history')
    expect(w.findAll('li')).toHaveLength(2)
    await w
      .findAll('button')
      .find((b) => b.text() === 'Load more')!
      .trigger('click')
    await flushPromises()
    expect(fn.mock.calls[1][0]).toBe('/v1/repos/alice/game/history?before=c1')
    expect(w.findAll('li').map((li) => li.text().slice(0, 2))).toEqual(['r3', 'r2', 'r1'])
    expect(w.text()).not.toContain('Load more')
  })

  it('sends the glob filter, and the path for a per-file entry point', async () => {
    vi.useFakeTimers()
    const fn = vi.fn().mockResolvedValue(reply(page([1], null)))
    const { w } = await mountView(fn)
    await w.find('input').setValue('Content/*.uasset')
    vi.advanceTimersByTime(400)
    vi.useRealTimers()
    await flushPromises()
    expect(fn.mock.calls[1][0]).toBe('/v1/repos/alice/game/history?filter=Content%2F*.uasset')
    await mountView(fn, '/alice/game/history?path=a.ts')
    expect(fn.mock.calls[2][0]).toBe('/v1/repos/alice/game/history?path=a.ts')
  })

  it('shows the server message for a bad pattern', async () => {
    const fn = vi
      .fn()
      .mockResolvedValue(reply({ code: 'invalid_request', message: 'bad glob: [' }, 400))
    const { w } = await mountView(fn, '/alice/game/history?filter=%5B')
    expect(w.find('[role=alert]').text()).toBe('bad glob: [')
  })
})

describe('PynAudit', () => {
  const entries = [
    {
      id: 1,
      at: '2026-10-08T11:00:00Z',
      actor: 'alice',
      action: 'repo_created',
      detail: 'alice/game',
    },
  ]

  it('shows the repository audit actions and emits the filter and load-more', async () => {
    const w = mount(PynAudit, {
      props: { entries, filter: { path: '', actor: '', action: '' }, hasMore: true },
    })
    expect(w.text()).toContain('repo_created')
    expect(w.findAll('option').map((o) => o.text())).toEqual(
      expect.arrayContaining(['repo_created', 'repo_updated', 'repo_deleted']),
    )
    await w.find('select').setValue('repo_updated')
    await w.find('form').trigger('submit')
    expect(w.emitted('filter')?.[0]).toEqual([{ path: '', actor: '', action: 'repo_updated' }])
    await w
      .findAll('button')
      .find((b) => b.text().startsWith('Load older'))!
      .trigger('click')
    expect(w.emitted('more')).toHaveLength(1)
  })
})

describe('PynMembers', () => {
  const props = { members: [{ user: 'bob', role: 'writer' }], roles: ['reader', 'writer'] }

  it('emits a role change and a new person', async () => {
    const w = mount(PynMembers, { props })
    await w.findAll('select')[0].setValue('reader')
    expect(w.emitted('setRole')?.[0]).toEqual([{ user: 'bob', role: 'reader' }])
    const inputs = w.find('form').findAll('input')
    await inputs[0].setValue('wendy')
    await inputs[1].setValue('a long password')
    await w.find('form').trigger('submit')
    expect(w.emitted('addUser')?.[0]).toEqual([
      { username: 'wendy', password: 'a long password', role: 'reader' },
    ])
  })
})

describe('PynRoles', () => {
  const grants = [{ role: 'reader', permissions: ['read'] }]

  it('emits the edited permissions', async () => {
    const w = mount(PynRoles, { props: { grants, canEdit: true } })
    await w.find('input[value=view_audit]').setValue(true)
    await w.find('form').trigger('submit')
    expect(w.emitted('save')?.[0]).toEqual([
      { role: 'reader', permissions: ['read', 'view_audit'] },
    ])
  })

  it('is read only without manage_roles', () => {
    const w = mount(PynRoles, { props: { grants } })
    expect(w.find('input').attributes('disabled')).toBeDefined()
    expect(w.find('button').exists()).toBe(false)
  })
})

describe('PynInvites', () => {
  const invites = [
    {
      id: 'i1',
      role: 'writer',
      created_by: 'alice',
      created_at: '',
      expires_at: '2026-10-11T09:00:00Z',
    },
    {
      id: 'i2',
      role: 'reader',
      created_by: 'alice',
      created_at: '',
      expires_at: '',
      used_by: 'wendy',
    },
  ]

  it('shows the one-time code, revokes only open invitations and creates', async () => {
    const w = mount(PynInvites, { props: { invites, roles: ['reader', 'writer'], code: 'pyni_x' } })
    expect(w.find('[role=status]').text()).toContain('pyni_x')
    expect(w.text()).toContain('used by wendy')
    const revoke = w.findAll('button').filter((b) => b.text() === 'Revoke')
    expect(revoke).toHaveLength(1)
    await revoke[0].trigger('click')
    expect(w.emitted('revoke')?.[0]).toEqual(['i1'])
    await w.find('input[type=number]').setValue('24')
    await w.find('form').trigger('submit')
    expect(w.emitted('create')?.[0]).toEqual([{ role: 'reader', hours: 24 }])
  })
})

describe('blob view', () => {
  const reply = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response
  const listing = {
    path: '',
    entries: [{ name: 'docs', path: 'docs', kind: 'folder', mode: 'shared' }],
  }

  async function open(url: string) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(listing)))
    const router = makeRouter(createMemoryHistory())
    await router.push(url)
    const w = mount(RepoBlobView, {
      global: {
        plugins: [router],
        provide: {
          [repoKey as symbol]: { target: ref({ owner: 'alice', name: 'game' }) },
          [sessionKey as symbol]: { user: ref('alice') },
        },
      },
    })
    await flushPromises()
    return { w, router }
  }

  it('redirects a folder opened as a file to the tree view', async () => {
    const { router } = await open('/alice/game/blob/docs')
    expect(router.currentRoute.value.path).toBe('/alice/game/tree/docs')
  })

  it('keeps the not-found state for a path that matches nothing', async () => {
    const { router, w } = await open('/alice/game/blob/missing')
    expect(router.currentRoute.value.path).toBe('/alice/game/blob/missing')
    expect(w.text()).toContain('missing')
  })
})
