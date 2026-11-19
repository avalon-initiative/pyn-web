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
