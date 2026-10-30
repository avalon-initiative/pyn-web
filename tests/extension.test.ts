import { flushPromises } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, inject } from 'vue'
import { createPynApp, EXTENSION_PREFIX, sessionKey } from '../src/index'
import type { PynExtension } from '../src/index'

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// A signed-in session for alice, a non-admin.
const signedIn = (url: string) => {
  if (url === '/v1/session') return reply(200, { user: 'alice', csrf_token: 'c' })
  if (url === '/v1/me') return reply(200, { user: 'alice', admin: false })
  if (url === '/v1/setup') return reply(200, { initialised: true })
  if (url === '/v1/repos' || url === '/v1/orgs') return reply(200, [])
  return reply(404, { code: 'not_found', message: 'x' })
}

const Sample = defineComponent({
  setup() {
    const session = inject(sessionKey)
    return () => h('section', { id: 'sample' }, `hello ${session?.user.value}`)
  },
})

async function open(path: string, ext?: PynExtension) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => Promise.resolve(signedIn(url))),
  )
  const history = createMemoryHistory()
  history.replace(path)
  const el = document.createElement('div')
  document.body.append(el)
  const app = createPynApp(ext, history)
  app.mount(el)
  await flushPromises()
  await flushPromises()
  return { el, app }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('createPynApp', () => {
  it('renders the standard shell with nothing registered', async () => {
    const { el } = await open('/')
    expect(el.textContent).toContain('Home')
    expect(el.textContent).not.toContain('Reports')
    expect(el.querySelector('#sample')).toBeNull()
  })

  it('renders a registered route inside the shell, with the session injected', async () => {
    const { el } = await open(`${EXTENSION_PREFIX}/sample`, {
      routes: [{ path: `${EXTENSION_PREFIX}/sample`, name: 'sample', component: Sample }],
    })
    expect(el.querySelector('aside')).not.toBeNull()
    expect(el.querySelector('#sample')?.textContent).toBe('hello alice')
  })

  it('lists a side-nav entry and an account-menu entry, and runs a menu button', async () => {
    const onSelect = vi.fn()
    const { el } = await open('/', {
      navItems: [{ id: 'reports', label: 'Reports', href: `${EXTENSION_PREFIX}/reports` }],
      accountMenuItems: [
        { id: 'usage', label: 'Usage report', href: `${EXTENSION_PREFIX}/usage` },
        { id: 'help', label: 'Get help', onSelect },
      ],
    })
    expect(el.querySelector(`aside a[href="${EXTENSION_PREFIX}/reports"]`)?.textContent).toContain(
      'Reports',
    )
    el.querySelector<HTMLElement>('[aria-label="Account menu"]')!.click()
    await flushPromises()
    expect(el.querySelector(`a[href="${EXTENSION_PREFIX}/usage"]`)?.textContent).toBe(
      'Usage report',
    )
    const help = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Get help')!
    help.click()
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('marks the extra nav entry current on its own pages', async () => {
    const { el } = await open(`${EXTENSION_PREFIX}/reports/1`, {
      routes: [{ path: `${EXTENSION_PREFIX}/reports/:id`, component: Sample }],
      navItems: [{ id: 'reports', label: 'Reports', href: `${EXTENSION_PREFIX}/reports` }],
    })
    const current = [...el.querySelectorAll('aside [aria-current]')].map((a) => a.textContent)
    expect(current).toEqual(['Reports'])
  })
})

describe('extension validation', () => {
  const route = (path: string, name?: string) => ({ path, name, component: Sample })

  it('rejects a route outside the reserved prefix', () => {
    for (const path of [
      '/reports',
      '/alice/reports',
      '/_/reports',
      `${EXTENSION_PREFIX}x`,
      '/:owner/x',
    ])
      expect(() => createPynApp({ routes: [route(path)] })).toThrow(/must be under/)
  })

  it('accepts the prefix itself and anything below it', () => {
    expect(() =>
      createPynApp({ routes: [route(EXTENSION_PREFIX), route(`${EXTENSION_PREFIX}/a/:id`)] }),
    ).not.toThrow()
  })

  it('rejects aliases, taken route names and taken entry ids', () => {
    expect(() =>
      createPynApp({ routes: [{ ...route(`${EXTENSION_PREFIX}/a`), alias: '/a' }] }),
    ).toThrow(/alias/)
    expect(() => createPynApp({ routes: [route(`${EXTENSION_PREFIX}/a`, 'files')] })).toThrow(
      /already used/,
    )
    expect(() => createPynApp({ navItems: [{ id: 'home', label: 'H', href: '/x' }] })).toThrow(
      /already used/,
    )
    expect(() =>
      createPynApp({ accountMenuItems: [{ id: 'webhooks', label: 'W', href: '/x' }] }),
    ).toThrow(/already used/)
  })

  it('rejects an external href', () => {
    expect(() =>
      createPynApp({ navItems: [{ id: 'x', label: 'X', href: 'https://example.com' }] }),
    ).toThrow(/internal/)
    expect(() =>
      createPynApp({ accountMenuItems: [{ id: 'x', label: 'X', href: '//example.com' }] }),
    ).toThrow(/internal/)
  })
})
