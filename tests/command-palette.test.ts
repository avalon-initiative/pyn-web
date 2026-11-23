import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { clearSessionData } from '../src/state/session-data.state'
import { resetTopBar } from '../src/state/top-bar.state'
import {
  chordTarget,
  localItems,
  paletteItems,
  shortcutBindings,
  shortcutGroups,
} from '../src/state/palette.state'
import { orgs } from './fixtures/org-data'
import { sampleRepos } from './fixtures/shell-data'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let admin = false
let calls: string[] = []

function server(url: string) {
  if (url === '/v1/session') return json({ user: 'alice', csrf_token: 'c' })
  if (url === '/v1/me') return json({ user: 'alice', admin })
  if (url === '/v1/setup') return json({ initialised: true })
  if (url === '/v1/repos') return json(sampleRepos)
  if (url === '/v1/me/orgs') return json(orgs)
  if (url.startsWith('/v1/users?'))
    return json({
      people: [{ identity: { user: 'zed', display_name: 'Zed Z' } }],
      next_after: null,
    })
  if (
    ['/v1/me/locks', '/v1/me/invitations', '/v1/me/notices', '/v1/me/access-sessions'].includes(url)
  )
    return json([])
  return json({ code: 'not_found', message: 'x' }, 404)
}

let apps: VueWrapper[] = []
beforeEach(() => {
  admin = false
  calls = []
  clearSessionData()
  resetTopBar()
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      calls.push(url)
      return Promise.resolve(server(url))
    }),
  )
})
afterEach(() => {
  apps.forEach((a) => a.unmount())
  apps = []
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function openApp(path = '/') {
  const router = makeRouter(createMemoryHistory())
  await router.push(path)
  const { default: App } = await import('../src/App.vue')
  const w = mount(App, { attachTo: document.body, global: { plugins: [router] } })
  apps.push(w as unknown as VueWrapper)
  await flushPromises()
  await flushPromises()
  return { w, router }
}

const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  )
const palette = () => document.querySelector('[role=dialog][aria-label="Command palette"]')
const help = () =>
  [...document.querySelectorAll('[role=dialog]')].find((d) =>
    d.textContent?.includes('Keyboard shortcuts'),
  )

describe('palette items', () => {
  const items = (a = false) =>
    localItems(a, sampleRepos as never, orgs as never, [
      { label: 'alice/old', href: '/alice/old', kind: 'repository' },
    ])

  it('offers pages, with administration only for administrators', () => {
    expect(items().some((i) => i.id === 'admin')).toBe(false)
    expect(items(true).some((i) => i.id === 'admin')).toBe(true)
    expect(
      items()
        .filter((i) => i.group === 'Pages')
        .map((i) => i.href),
    ).toEqual(
      expect.arrayContaining([
        '/',
        '/_/locks',
        '/_/invitations',
        '/_/settings',
        '/_/new',
        '/_/new-org',
      ]),
    )
  })

  it('lists repositories, organizations and recent items by their routes', () => {
    const all = items()
    const r = sampleRepos[0]!
    expect(all.find((i) => i.id === `repo:${r.owner}/${r.name}`)?.href).toBe(
      `/${r.owner}/${r.name}`,
    )
    expect(all.find((i) => i.group === 'Organizations')?.href).toBe(`/${orgs[0]!.name}`)
    expect(all.find((i) => i.group === 'Recent')?.href).toBe('/alice/old')
  })

  it('filters locally with the library match and appends server people', () => {
    const people = [{ id: 'person:zed', label: 'zed', group: 'People', href: '/zed' }]
    const shown = paletteItems(items(), 'lock', people)
    expect(shown.map((i) => i.label)).toContain('Your locks')
    expect(shown.map((i) => i.label)).not.toContain('Dashboard')
    expect(shown.at(-1)?.id).toBe('person:zed')
  })
})

describe('shortcut tables', () => {
  it('has no prefix clashes and resolves chords by context', () => {
    const keys = shortcutBindings().map((b) => b.keys.join(' '))
    expect(new Set(keys).size).toBe(keys.length)
    expect(chordTarget('dashboard', null)).toBe('/')
    expect(chordTarget('locks', null)).toBeNull()
    expect(chordTarget('locks', { owner: 'a', name: 'b' })).toBe('/a/b/locks')
    expect(chordTarget('settings', null)).toBe('/_/settings')
    expect(chordTarget('settings', { owner: 'a', name: 'b' })).toBe('/a/b/settings')
    expect(chordTarget('policy', { owner: 'a', name: 'b' })).toBe('/a/b/settings/policy')
  })

  it('lists repository shortcuts only inside a repository', () => {
    expect(shortcutGroups(false).map((g) => g.title)).toEqual(['Anywhere'])
    expect(shortcutGroups(true).map((g) => g.title)).toEqual(['Anywhere', 'In a repository'])
  })
})

describe('in the app', () => {
  it('opens on Ctrl+K and Cmd+K, toggles, and closes on Escape', async () => {
    await openApp()
    expect(palette()).toBeNull()
    press('k', { ctrlKey: true })
    await flushPromises()
    expect(palette()).not.toBeNull()
    press('k', { metaKey: true })
    await flushPromises()
    expect(palette()).toBeNull()
    press('k', { ctrlKey: true })
    await flushPromises()
    document
      .querySelector('[role=dialog] input')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(palette()).toBeNull()
  })

  it('navigates to the chosen item', async () => {
    const { router } = await openApp()
    press('k', { ctrlKey: true })
    await flushPromises()
    const link = document.querySelector<HTMLAnchorElement>('[role=listbox] a[href="/_/locks"]')!
    link.click()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/_/locks')
    expect(palette()).toBeNull()
  })

  it('shows people from the server as the person types', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await openApp()
    press('k', { ctrlKey: true })
    await vi.advanceTimersByTimeAsync(0)
    const field = document.querySelector<HTMLInputElement>('[role=dialog] input')!
    field.value = 'ze'
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    expect(calls.some((c) => c.startsWith('/v1/users?') && c.includes('q=ze'))).toBe(true)
    expect(document.querySelector('[role=listbox] a[href="/zed"]')).not.toBeNull()
  })

  it('goes to a page on g then a letter', async () => {
    const { router } = await openApp('/_/people')
    press('g')
    press('m')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/_/locks')
    press('g')
    press('d')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('uses repository chords inside a repository only', async () => {
    const { router } = await openApp('/_/people')
    press('g')
    press('h')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/_/people')
    await router.push('/acme/game')
    await flushPromises()
    press('g')
    press('h')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/acme/game/history')
  })

  it('never fires while typing in a field', async () => {
    const { router } = await openApp('/_/people')
    const input = document.createElement('input')
    document.body.append(input)
    press('g', {}, input)
    press('m', {}, input)
    press('?', {}, input)
    press('k', {}, input)
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/_/people')
    expect(help()).toBeUndefined()
  })

  it('opens the help dialog on ? and lists the shortcuts', async () => {
    await openApp()
    press('?', { shiftKey: true })
    await flushPromises()
    const text = help()?.textContent ?? ''
    expect(text).toContain('Go to dashboard')
    expect(text).toContain('Open the command palette')
  })
})
