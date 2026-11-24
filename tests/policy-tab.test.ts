import {
  PynBranchesPage,
  PynPolicyView,
  PynRepoShell,
  PynFileView,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { ruleLine } from '../src/state/policy.state'
import { withPolicyTabs } from '../src/state/repo-tabs.state'
import { repo as repoInfo, rootEntries, summary } from './fixtures/landing-data'

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const branch = (name: string, isDefault = false) => ({
  name,
  commit: 'a'.repeat(40),
  default: isDefault,
  created_at: '2026-10-01T09:00:00Z',
  updated_at: '2026-10-02T09:00:00Z',
  created_by: 'bob',
})

const policy = {
  default_mode: 'shared',
  source: 'file',
  commit: 'abcdef1234567890',
  rules: [
    { pattern: '*.png', mode: 'exclusive' },
    { pattern: 'docs/', mode: 'shared' },
  ],
  paths: [{ path: 'pic.png', mode: 'exclusive', rule: { index: 0, pattern: '*.png' } }],
}

function stubServer(
  calls: string[],
  permissions = ['read'],
  overrides: Record<string, unknown> = {},
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      calls.push(url)
      const [path] = url.split('?')
      if (path in overrides) {
        const body = overrides[path] as { code?: string }
        return json(body, body.code ? 500 : 200)
      }
      if (path === '/v1/session')
        return json({ user: 'bob', csrf_token: 't', expires_at: '2030-01-01T00:00:00Z' })
      if (path === '/v1/setup') return json({ initialised: true })
      if (path === '/v1/me') return json({ user: 'bob', admin: false })
      if (path === '/v1/server') return json({ version: '0', revision: 'x' })
      if (path === '/v1/repos/acme/game') return json({ ...repoInfo, owner: 'acme', name: 'game' })
      if (path === '/v1/repos/acme/game/me') return json({ permissions })
      if (path === '/v1/repos/acme/game/branches')
        return json([branch('main', true), branch('feature')])
      if (path === '/v1/repos/acme/game/compare')
        return json({
          base: 'main',
          head: 'feature',
          status: 'diverged',
          ahead: 3,
          behind: 1,
          changes: [],
        })
      if (path === '/v1/repos/acme/game/policy') return json(policy)
      if (path === '/v1/repos/acme/game/tree')
        return json({
          path: '',
          entries: [...rootEntries, { ...rootEntries[3], name: 'pic.png', path: 'pic.png' }],
        })
      if (path === '/v1/repos/acme/game/summary') return json(summary)
      if (path === '/v1/orgs/acme') return json({ code: 'org_not_found' }, 404)
      if (path.startsWith('/v1/owners/')) return json({ frozen: false })
      return json({ code: 'not_found', message: 'x' }, 404)
    }),
  )
}

async function open(path: string, permissions = ['read'], overrides = {}) {
  const calls: string[] = []
  stubServer(calls, permissions, overrides)
  const router = makeRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const { default: App } = await import('../src/App.vue')
  const w = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  await flushPromises()
  return { w, router, calls }
}

afterEach(() => vi.unstubAllGlobals())

describe('tab row', () => {
  it('puts Pull requests after Code, Branches before History and Policy after it', () => {
    const tabs = [
      { section: '', label: 'Code' },
      { section: 'locks', label: 'Locks' },
      { section: 'history', label: 'History' },
      { section: 'settings', label: 'Settings' },
    ]
    expect(withPolicyTabs(tabs).map((t) => t.label)).toEqual([
      'Code',
      'Pull requests',
      'Locks',
      'Branches',
      'History',
      'Policy',
      'Settings',
    ])
  })

  it('shows both tabs to a reader', async () => {
    const { w } = await open('/acme/game')
    const labels = w
      .findComponent(PynRepoShell)
      .props('tabs')!
      .map((t: { label: string }) => t.label)
    expect(labels).toContain('Branches')
    expect(labels).toContain('Policy')
  })
})

describe('policy tab', () => {
  it('shows the default mode, the rules and the commit', async () => {
    const { w } = await open('/acme/game/policy')
    const view = w.findComponent(PynPolicyView)
    expect(view.props('mode')).toBe('shared')
    expect(view.props('rules')).toEqual(policy.rules)
    expect(w.find('[data-policy-commit]').text()).toContain('abcdef1')
    expect(w.find('[data-policy-commit] a').attributes('href')).toContain('path=.pyn%2Fpyn.toml')
  })

  it('links to the editor only with edit_policy', async () => {
    const reader = await open('/acme/game/policy')
    expect(reader.w.findComponent(PynPolicyView).props('editHref')).toBeUndefined()
    const editor = await open('/acme/game/policy', ['read', 'edit_policy'])
    expect(editor.w.findComponent(PynPolicyView).props('editHref')).toBe(
      '/acme/game/settings/policy',
    )
  })

  it('shows the server warning', async () => {
    const { w } = await open('/acme/game/policy', ['read'], {
      '/v1/repos/acme/game/policy': {
        ...policy,
        warning: 'pyn.toml is invalid',
        source: 'initial',
      },
    })
    expect(w.find('[data-policy-warning]').text()).toBe('pyn.toml is invalid')
  })

  it('shows the error when the policy cannot be read', async () => {
    const { w } = await open('/acme/game/policy', ['read'], {
      '/v1/repos/acme/game/policy': { code: 'internal', message: 'boom' },
    })
    expect(w.findComponent(PynPolicyView).props('error')).toBeTruthy()
  })
})

describe('branches page', () => {
  it('lists branches with the default marked and ahead/behind from compare', async () => {
    const { w, calls } = await open('/acme/game/branches')
    const items = w.findComponent(PynBranchesPage).props('branches')
    expect(items).toEqual([
      expect.objectContaining({ name: 'main', isDefault: true, href: '/acme/game' }),
      expect.objectContaining({
        name: 'feature',
        ahead: 3,
        behind: 1,
        href: '/acme/game?branch=feature',
        compareHref: '/acme/game?branch=feature',
      }),
    ])
    expect(calls.filter((c) => c.startsWith('/v1/repos/acme/game/compare'))).toHaveLength(1)
  })

  it('keeps the list when a compare fails', async () => {
    const { w } = await open('/acme/game/branches', ['read'], {
      '/v1/repos/acme/game/compare': { code: 'internal', message: 'boom' },
    })
    const items = w.findComponent(PynBranchesPage).props('branches')
    expect(items.map((b: { name: string }) => b.name)).toEqual(['main', 'feature'])
    expect(items[1].ahead).toBeUndefined()
  })

  it('links the overview panel to the page', async () => {
    const { w } = await open('/acme/game')
    expect(w.find('a[href="/acme/game/branches"]').exists()).toBe(true)
  })
})

describe('file page', () => {
  it('names the rule that matches the path', async () => {
    const { w, calls } = await open('/acme/game/blob/pic.png')
    expect(w.findComponent(PynFileView).props('note')).toBe('Exclusive: matches rule "*.png"')
    expect(w.text()).toContain('Exclusive: matches rule "*.png"')
    expect(calls.some((c) => c.includes('/policy?path=pic.png'))).toBe(true)
  })

  it('links to the history filtered by the file', async () => {
    const { w } = await open('/acme/game/blob/pic.png')
    expect(w.find('a[href*="/acme/game/history?path=pic.png"]').exists()).toBe(true)
  })

  it('shows the viewer no rule line when the policy cannot be read', async () => {
    const { w } = await open('/acme/game/blob/pic.png', ['read'], {
      '/v1/repos/acme/game/policy': { default_mode: 'shared', source: 'file', rules: [] },
    })
    expect(w.findComponent(PynFileView).props('note')).toBeUndefined()
  })
})

describe('ruleLine', () => {
  it('words a matched rule, the default and no answer', () => {
    expect(ruleLine({ path: 'a', mode: 'shared', rule: { index: 1, pattern: 'docs/' } })).toBe(
      'Shared: matches rule "docs/"',
    )
    expect(ruleLine({ path: 'a', mode: 'shared' })).toContain('default')
    expect(ruleLine(undefined)).toBe('')
  })
})
