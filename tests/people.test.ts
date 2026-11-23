import {
  PynPeopleList,
  PynSignIn,
  PynTopBar,
  PynViewNotice,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePeople } from '../src/state/people.state'

const entry = (user: string) => ({ identity: { user }, links: [] })

function stub(handler: (url: string) => Response) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url)
      return handler(url)
    }),
  )
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('people directory', () => {
  it('searches, then pages with next_after', async () => {
    const calls = stub((url) =>
      Response.json(
        url.includes('after=')
          ? { people: [entry('cy')], next_after: null }
          : { people: [entry('ada'), entry('bo')], next_after: 'bo' },
      ),
    )
    const p = usePeople(2)
    await p.search(' a ')
    expect(calls[0]).toBe('/v1/users?q=a&limit=2')
    expect(p.people.value.map((x) => x.identity.user)).toEqual(['ada', 'bo'])
    await p.more()
    expect(calls[1]).toBe('/v1/users?q=a&after=bo&limit=2')
    expect(p.people.value).toHaveLength(3)
    expect(p.next.value).toBeNull()
    await p.more()
    expect(calls).toHaveLength(2)
  })

  it('shows a 429 with the wait and keeps the list', async () => {
    let limited = false
    stub(() =>
      limited
        ? Response.json(
            { code: 'too_many_attempts', message: 'slow down' },
            { status: 429, headers: { 'Retry-After': '30' } },
          )
        : Response.json({ people: [entry('ada')], next_after: 'ada' }),
    )
    const p = usePeople()
    await p.search('')
    limited = true
    await p.more()
    expect(p.error.value).toMatch(/Too many attempts.*30/)
    expect(p.people.value).toHaveLength(1)
    expect(p.busy.value).toBe(false)
  })

  it('caps the search text at 64 characters', async () => {
    stub(() => Response.json({ people: [], next_after: null }))
    const p = usePeople()
    await p.search('x'.repeat(80))
    expect(p.query.value).toHaveLength(64)
  })
})

describe('people page', () => {
  const respond =
    (signedIn: boolean, people: Response | null = null) =>
    (url: string) => {
      if (url.startsWith('/v1/users?')) return people ?? Response.json({ people: [entry('ada')] })
      if (url === '/v1/me' || url === '/v1/session')
        return signedIn
          ? Response.json({ user: 'dave', admin: false, profile: {} })
          : Response.json({ code: 'unauthenticated', message: 'x' }, { status: 401 })
      if (url === '/v1/setup') return Response.json({ initialised: true })
      return Response.json(signedIn ? [] : { code: 'unauthenticated', message: 'x' }, {
        status: signedIn ? 200 : 401,
      })
    }

  const open = async (path: string) => {
    const router = makeRouter(createMemoryHistory())
    await router.push(path)
    await router.isReady()
    const { default: App } = await import('../src/App.vue')
    const w = mount(App, { global: { plugins: [router] } })
    await flushPromises()
    return { w, router }
  }

  it('is public', () => {
    expect(makeRouter(createMemoryHistory()).resolve('/_/people').meta.public).toBe(true)
  })

  it('shows the list signed out with a sign-in link, and sign-in elsewhere', async () => {
    stub(respond(false))
    const { w, router } = await open('/_/people')
    expect(w.findComponent(PynPeopleList).props('people')).toHaveLength(1)
    const bar = w.findComponent(PynTopBar)
    expect(bar.props('signedOut')).toBe(true)
    expect(bar.props('signInHref')).toBe('/')
    expect(w.findComponent(PynSignIn).exists()).toBe(false)
    await router.push('/')
    await flushPromises()
    expect(w.findComponent(PynSignIn).exists()).toBe(true)
  })

  it('shows a rate limit as a notice, not a failure', async () => {
    stub(
      respond(
        false,
        Response.json(
          { code: 'too_many_attempts', message: 'x' },
          { status: 429, headers: { 'Retry-After': '90' } },
        ),
      ),
    )
    const { w } = await open('/_/people')
    expect(w.findComponent(PynViewNotice).text()).toMatch(/Too many attempts.*2 minutes/)
  })

  it('shows the same page signed in, inside the full shell', async () => {
    stub(respond(true))
    const { w } = await open('/_/people')
    expect(w.findComponent(PynPeopleList).props('people')).toHaveLength(1)
    expect(w.findComponent(PynTopBar).props('signedOut')).toBeFalsy()
    expect(w.find('aside').exists()).toBe(false)
  })
})
