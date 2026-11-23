import { accountNav, accountNavItems, navItems } from '@avalon-initiative/pyn-common-ui'
import { createMemoryHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { makeRouter } from '../src/router'
import { sideNavItems } from '../src/state/shell.state'

const resolve = (path: string) => makeRouter(createMemoryHistory()).resolve(path)

describe('catch-all route', () => {
  it.each([
    '/a/b/c',
    '/a/b/c/d',
    '/a/b/blob',
    '/_',
    '/_/',
    '/_/nothing',
    '/_/nothing/deeper',
    '/_/keys',
    '/_/tokens',
    '/_/settings/nothing',
  ])('%s is not found', (path) => {
    expect(resolve(path).name).toBe('not-found')
  })

  it('treats a single segment as an owner page', () => {
    expect(resolve('/nothing').name).toBe('owner')
  })

  it('keeps real repository, owner and tab paths on their views', () => {
    expect(resolve('/alice').name).toBe('owner')
    expect(resolve('/alice/game').name).toBe('files')
    expect(resolve('/alice/game/tree/src/lib').name).toBe('tree')
    expect(resolve('/alice/game/blob/src/a.txt').name).toBe('blob')
    expect(resolve('/alice/game/locks').name).toBe('locks')
    expect(resolve('/alice/game/settings/policy').name).toBe('settings-policy')
    expect(resolve('/acme/-/members').name).toBe('org-members')
    expect(resolve('/a_b/c_d').name).toBe('files')
    expect(resolve('/__/game').name).toBe('files')
  })

  it('keeps every personal-area route', () => {
    for (const [path, name] of [
      ['/_/people', 'people'],
      ['/_/locks', 'my-locks'],
      ['/_/new', 'new-repo'],
      ['/_/new-org', 'new-org'],
      ['/_/orgs', 'orgs'],
      ['/_/invitations', 'invitations'],
      ['/_/admin/accounts', 'admin-accounts'],
      ['/_/settings/keys', 'keys'],
      ['/_/settings/tokens', 'tokens'],
    ]) {
      expect(resolve(path).name).toBe(name)
    }
  })

  it('is public so a signed-out visitor sees it', () => {
    expect(resolve('/a/b/c').meta.public).toBe(true)
  })
})

describe('account settings index', () => {
  it('lands on Profile', async () => {
    const router = makeRouter(createMemoryHistory())
    await router.push('/_/settings')
    expect(router.currentRoute.value.name).toBe('profile-settings')
  })
})

describe('navigation targets', () => {
  const settings = [
    { id: 'profile-settings', href: '/_/settings/profile' },
    { id: 'emails', href: '/_/settings/emails' },
    { id: 'username', href: '/_/settings/username' },
    { id: 'security', href: '/_/settings/security' },
    { id: 'delete-account', href: '/_/settings/delete' },
  ]
  const hrefs = [
    ...sideNavItems(true).map((i) => i.href),
    ...navItems(true).map((i) => i.href),
    ...accountNav.map((i) => i.href),
    ...accountNavItems(true).map((i) => i.href),
    ...settings.map((i) => i.href),
  ]

  it.each([...new Set(hrefs)])('%s resolves to a real route', (href) => {
    const r = resolve(href)
    expect(r.matched.length).toBeGreaterThan(0)
    expect(r.name).not.toBe('not-found')
  })
})
