import { mount } from '@vue/test-utils'
import { PynPageNotFound, PynShell } from '@avalon-initiative/pyn-common-ui'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { breadcrumbs } from '../src/state/breadcrumbs.state'
import NotFoundView from '../src/views/NotFoundView.vue'

const router = makeRouter(createMemoryHistory())
const H = { label: 'Home', href: '/' }
const trail = (path: string) => breadcrumbs(router.resolve(path))
const labels = (path: string) => trail(path).map((c) => c.label)

const table: [string, string, ...(string | undefined)[]][] = [
  ['/', 'dashboard'],
  ['/_/repos', 'repos', 'Home', 'Repositories'],
  ['/_/people', 'people', 'Home', 'People'],
  ['/_/locks', 'my-locks', 'Home', 'Your locks'],
  ['/_/new', 'new-repo', 'Home', 'New repository'],
  ['/_/new-org', 'new-org', 'Home', 'New organization'],
  ['/_/orgs', 'orgs', 'Home', 'Organizations'],
  ['/_/invitations', 'invitations', 'Home', 'Invitations'],
  ['/_/admin/accounts', 'admin-accounts', 'Home', 'Administration', 'Accounts'],
  ['/_/admin/access', 'admin-access', 'Home', 'Administration', 'Server access'],
  ['/_/admin/two-factor', 'admin-two-factor', 'Home', 'Administration', 'Two-factor'],
  [
    '/_/admin/access-sessions',
    'admin-access-sessions',
    'Home',
    'Administration',
    'Access sessions',
  ],
  ['/_/admin/audit', 'admin-audit', 'Home', 'Administration', 'Audit log'],
  ['/_/admin/invitations', 'admin-invitations', 'Home', 'Administration', 'Invitations'],
  ['/_/admin/webhooks', 'admin-webhooks', 'Home', 'Administration', 'Webhooks'],
  ['/_/settings/profile', 'profile-settings', 'Home', 'Settings', 'Profile'],
  ['/_/settings/emails', 'emails', 'Home', 'Settings', 'Email addresses'],
  ['/_/settings/username', 'username', 'Home', 'Settings', 'Username'],
  ['/_/settings/password', 'password', 'Home', 'Settings', 'Password'],
  ['/_/settings/security', 'security', 'Home', 'Settings', 'Security'],
  ['/_/settings/keys', 'keys', 'Home', 'Settings', 'SSH keys'],
  ['/_/settings/tokens', 'tokens', 'Home', 'Settings', 'Access tokens'],
  ['/_/settings/identities', 'identities', 'Home', 'Settings', 'Linked sign-in'],
  ['/_/settings/delete', 'delete-account', 'Home', 'Settings', 'Delete account'],
  ['/alice', 'owner', 'Home', 'alice'],
  ['/alice/-/usage', 'owner-usage', 'Home', 'alice', 'Usage'],
  ['/acme/-/members', 'org-members', 'Home', 'acme', 'Members'],
  ['/acme/-/teams', 'org-teams', 'Home', 'acme', 'Teams'],
  ['/acme/-/teams/art', 'org-team', 'Home', 'acme', 'Teams', 'art'],
  ['/acme/-/audit', 'org-audit', 'Home', 'acme', 'Audit log'],
  ['/acme/-/settings', 'org-settings', 'Home', 'acme', 'Settings'],
  ['/alice/game', 'files', 'Home', 'alice', 'game', 'Code'],
  ['/alice/game/tree/src/lib', 'tree', 'Home', 'alice', 'game', 'Code', 'src', 'lib'],
  ['/alice/game/blob/src/a.txt', 'blob', 'Home', 'alice', 'game', 'Code', 'src', 'a.txt'],
  ['/alice/game/locks', 'locks', 'Home', 'alice', 'game', 'Locks'],
  ['/alice/game/history', 'history', 'Home', 'alice', 'game', 'History'],
  ['/alice/game/settings', 'settings', 'Home', 'alice', 'game', 'Settings'],
  [
    '/alice/game/settings/members',
    'settings-members',
    'Home',
    'alice',
    'game',
    'Settings',
    'Members',
  ],
  ['/alice/game/settings/roles', 'settings-roles', 'Home', 'alice', 'game', 'Settings', 'Roles'],
  [
    '/alice/game/settings/invites',
    'settings-invites',
    'Home',
    'alice',
    'game',
    'Settings',
    'Invitations',
  ],
  ['/alice/game/settings/policy', 'settings-policy', 'Home', 'alice', 'game', 'Settings', 'Policy'],
  [
    '/alice/game/settings/storage',
    'settings-storage',
    'Home',
    'alice',
    'game',
    'Settings',
    'Storage',
  ],
  [
    '/alice/game/settings/audit',
    'settings-audit',
    'Home',
    'alice',
    'game',
    'Settings',
    'Audit log',
  ],
]

describe('breadcrumb trail', () => {
  it.each(table)('%s (%s)', (path, name, ...expected) => {
    expect(router.resolve(path).name).toBe(name)
    expect(labels(path)).toEqual(name === 'dashboard' ? [] : expected.length ? expected : [])
  })

  it('covers every named route in the router', () => {
    const covered = new Set(table.map((r) => r[1]))
    const named = router
      .getRoutes()
      .map((r) => String(r.name ?? ''))
      .filter((n) => n && n !== 'not-found' && n !== 'verify-email')
    expect(named.filter((n) => !covered.has(n))).toEqual([])
  })

  it('has no trail on the home, not-found and verification pages', () => {
    expect(labels('/')).toEqual([])
    expect(labels('/a/b/c')).toEqual([])
    expect(labels('/verify-email')).toEqual([])
  })

  it('links every crumb but the last to a real page', () => {
    for (const [path] of table) {
      const crumbs = trail(path)
      crumbs.slice(0, -1).forEach((c) => {
        expect(c.href, `${path}: ${c.label}`).toBeTruthy()
        const r = router.resolve(c.href!)
        expect(r.matched.length).toBeGreaterThan(0)
        expect(r.name).not.toBe('not-found')
      })
      expect(crumbs.at(-1)?.href, path).toBeUndefined()
    }
  })

  it('links folders to their tree route, keeping the branch', () => {
    const crumbs = breadcrumbs(router.resolve('/alice/game/blob/a%20b/c/d.txt?branch=dev'))
    expect(crumbs.map((c) => c.href)).toEqual([
      '/',
      '/alice',
      '/alice/game?branch=dev',
      '/alice/game?branch=dev',
      '/alice/game/tree/a%20b?branch=dev',
      '/alice/game/tree/a%20b/c?branch=dev',
      undefined,
    ])
  })

  it('links the owner of an organization page and the account areas', () => {
    expect(trail('/acme/-/teams/art').map((c) => c.href)).toEqual([
      '/',
      '/acme',
      '/acme/-/teams',
      undefined,
    ])
    expect(trail('/_/settings/keys')[1]).toEqual({ label: 'Settings', href: '/_/settings/profile' })
    expect(trail('/_/admin/audit')[1]).toEqual({
      label: 'Administration',
      href: '/_/admin/accounts',
    })
    expect(trail('/alice/game/settings/policy')[3]).toEqual({
      label: 'Settings',
      href: '/alice/game/settings',
    })
    expect(trail('/alice/game/history')[0]).toEqual(H)
  })

  it('keeps a label as text, never markup', () => {
    const last = breadcrumbs(router.resolve('/alice/game/blob/%3Cb%3Ex.txt')).at(-1)
    expect(last?.label).toBe('<b>x.txt')
    const w = mount(PynShell, { props: { breadcrumbs: [H, { label: '<b>x.txt' }] } })
    expect(w.find('b').exists()).toBe(false)
  })

  it('lets a build-time route name its page', () => {
    const extra = makeRouter(createMemoryHistory(), [
      { path: '/_/x/report', name: 'x-report', component: NotFoundView, meta: { crumb: 'Report' } },
    ])
    expect(breadcrumbs(extra.resolve('/_/x/report')).map((c) => c.label)).toEqual([
      'Home',
      'Report',
    ])
  })
})

describe('not-found page', () => {
  it('offers the previous page when the router has one', async () => {
    const history = createMemoryHistory()
    const r = makeRouter(history)
    await r.push('/alice/game')
    await r.push('/a/b/c')
    const w = mount(NotFoundView, { global: { plugins: [r] } })
    expect(w.findComponent(PynPageNotFound).props('backHref')).toBe('/alice/game')
    expect(w.find('a[data-back]').attributes('href')).toBe('/alice/game')
  })

  it('shows only the home link on a fresh load', async () => {
    const r = makeRouter(createMemoryHistory())
    await r.push('/a/b/c')
    const w = mount(NotFoundView, { global: { plugins: [r] } })
    expect(w.findComponent(PynPageNotFound).props('backHref')).toBeUndefined()
    expect(w.find('a[data-back]').exists()).toBe(false)
    expect(w.find('a[href="/"]').exists()).toBe(true)
  })
})
