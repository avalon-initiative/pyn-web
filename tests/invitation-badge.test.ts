import { flushPromises } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPynApp } from '../src/index'
import { invitations } from './fixtures/org-data'

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Mine = () => Response

async function open(path: string, mine: Mine, calls: string[] = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`)
      if (url === '/v1/session')
        return Promise.resolve(reply(200, { user: 'alice', csrf_token: 'c' }))
      if (url === '/v1/me') return Promise.resolve(reply(200, { user: 'alice', admin: false }))
      if (url === '/v1/setup') return Promise.resolve(reply(200, { initialised: true }))
      if (url === '/v1/me/invitations') return Promise.resolve(mine())
      if (url.endsWith('/decline')) return Promise.resolve(new Response(null, { status: 204 }))
      if (url === '/v1/repos' || url === '/v1/orgs') return Promise.resolve(reply(200, []))
      return Promise.resolve(reply(404, { code: 'not_found', message: 'x' }))
    }),
  )
  const history = createMemoryHistory()
  history.replace(path)
  const el = document.createElement('div')
  document.body.append(el)
  createPynApp(undefined, history).mount(el)
  await flushPromises()
  await flushPromises()
  return el
}

const entry = (el: HTMLElement) =>
  [...el.querySelectorAll('aside a')].find((a) => a.getAttribute('href') === '/_/invitations')!

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('invitations side-nav badge', () => {
  it('shows the pending count', async () => {
    const el = await open('/', () => reply(200, invitations))
    expect(entry(el).textContent).toContain(String(invitations.length))
  })

  it('shows no badge when nothing is pending', async () => {
    const el = await open('/', () => reply(200, []))
    expect(entry(el).textContent?.trim()).toBe('Invitations')
  })

  it('shows no badge and still renders the shell when the fetch fails', async () => {
    const el = await open('/', () => reply(500, { code: 'internal', message: 'x' }))
    expect(entry(el).textContent?.trim()).toBe('Invitations')
  })

  it('refreshes after a decline', async () => {
    let left = invitations.length
    const el = await open('/_/invitations', () => reply(200, invitations.slice(0, left)))
    expect(entry(el).textContent).toContain(String(left))
    left = 1
    const decline = [...el.querySelectorAll('button')].find((b) =>
      /decline/i.test(b.textContent ?? ''),
    )!
    decline.click()
    await flushPromises()
    expect(entry(el).textContent).toContain('1')
    expect(entry(el).textContent).not.toContain(String(invitations.length))
  })
})
