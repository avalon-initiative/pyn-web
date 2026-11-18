import { PynTokens } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { sessionKey } from '../src/state/context.state'
import TokensView from '../src/views/TokensView.vue'

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const info = (id: string, owner = 'ann') => ({
  id,
  user: 'ann',
  name: 'ci',
  owner,
  created_at: '2026-11-17T00:00:00Z',
  sign_in: false,
  repository_access: { mode: 'selected', repos: [`${owner}/game`] },
  permissions: [{ resource: 'contents', level: 'write' }],
})

const repo = (owner: string, name: string) => ({ owner, name })

describe('TokensView', () => {
  const calls: { url: string; method: string; body?: unknown }[] = []

  const stub = () => {
    calls.length = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string, init: RequestInit = {}) => {
        const method = init.method ?? 'GET'
        calls.push({
          url: path,
          method,
          body: init.body ? JSON.parse(String(init.body)) : undefined,
        })
        if (path === '/v1/tokens' && method === 'GET') return json([info('t1')])
        if (path === '/v1/tokens' && method === 'POST')
          return json({ token: 'pyn_secret', info: info('t2') }, 201)
        if (path.startsWith('/v1/tokens/') && method === 'DELETE')
          return Promise.resolve(new Response(null, { status: 204 }))
        if (path === '/v1/me/orgs') return json([{ name: 'acme', role: 'owner' }])
        if (path === '/v1/repos?owner=ann') return json([repo('ann', 'game')])
        if (path === '/v1/repos?owner=acme') return json([repo('acme', 'tools')])
        return json({ error: 'unexpected' }, 404)
      }),
    )
  }

  const open = async () => {
    stub()
    const w = mount(TokensView, {
      global: {
        provide: {
          [sessionKey as symbol]: { user: ref('ann'), admin: ref(false), expire: vi.fn() },
        },
      },
    })
    await flushPromises()
    return w
  }

  afterEach(() => vi.unstubAllGlobals())

  it('lists the tokens, the account and its orgs as owners, and the account repos', async () => {
    const w = await open()
    const t = w.getComponent(PynTokens)
    expect(t.props('tokens')).toHaveLength(1)
    expect(t.props('owners')).toEqual([
      { name: 'ann', kind: 'account' },
      { name: 'acme', kind: 'org' },
    ])
    expect(t.props('repos')).toEqual(['ann/game'])
  })

  it('loads the chosen owner repositories on owner-change', async () => {
    const w = await open()
    const t = w.getComponent(PynTokens)
    t.vm.$emit('owner-change', 'acme')
    await flushPromises()
    expect(t.props('repos')).toEqual(['acme/tools'])
  })

  it('posts the form as the request body, shows the secret and reloads', async () => {
    const w = await open()
    const form = {
      name: 'ci',
      owner: 'acme',
      repository_access: { mode: 'selected', repos: ['acme/tools'] },
      permissions: [{ resource: 'contents', level: 'write' }],
    }
    w.getComponent(PynTokens).vm.$emit('create', form)
    await flushPromises()
    const post = calls.find((c) => c.method === 'POST')!
    expect(post.url).toBe('/v1/tokens')
    expect(post.body).toEqual(form)
    expect(w.getComponent(PynTokens).props('secret')).toBe('pyn_secret')
    expect(calls.filter((c) => c.method === 'GET' && c.url === '/v1/tokens')).toHaveLength(2)
  })

  it('revokes by id and clears the secret on dismiss', async () => {
    const w = await open()
    const t = w.getComponent(PynTokens)
    t.vm.$emit('revoke', 't1')
    await flushPromises()
    expect(calls.some((c) => c.method === 'DELETE' && c.url === '/v1/tokens/t1')).toBe(true)
    t.vm.$emit('create', {
      name: 'x',
      owner: 'ann',
      repository_access: { mode: 'public' },
      permissions: [],
    })
    await flushPromises()
    t.vm.$emit('dismiss')
    await flushPromises()
    expect(t.props('secret')).toBe('')
  })
})
