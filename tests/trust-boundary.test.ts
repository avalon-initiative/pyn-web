import { PynLocks } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { fetchMe } from '../src/api/admin'
import { signIn, signOut } from '../src/api/auth'
import { forceUnlock, releaseLock } from '../src/api/repos'
import { createToken } from '../src/api/tokens'
import { repoKey, sessionKey } from '../src/state/context.state'
import RepoLocksView from '../src/views/RepoLocksView.vue'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Names a client must never invent: the server derives all of them from the session or token.
const CLAIM =
  /^(user|username|actor|owner_id|role|roles|permissions?|admin|is_admin|entitlements?)$/i
const ALLOWED_HEADERS = new Set(['accept', 'content-type', 'x-pyn-csrf'])

function claimKeys(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => claimKeys(v, found))
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) {
      if (CLAIM.test(k)) found.push(k)
      claimKeys(v, found)
    }
  return found
}

describe('requests through the typed client', () => {
  const sent: { method: string; url: string; headers: Headers; body: string }[] = []

  beforeEach(() => {
    sent.length = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        sent.push({
          method: init.method ?? 'GET',
          url,
          headers: new Headers(init.headers),
          body: String(init.body ?? ''),
        })
        if (url === '/v1/session') return json({ user: 'ann', csrf_token: 'csrf-from-server' })
        return init.method === 'GET' ? json({ admin: false, user: 'ann' }) : json({}, 200)
      }),
    )
  })
  afterEach(async () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', async () => new Response(null, { status: 204 }))
    await signOut()
    vi.unstubAllGlobals()
  })

  it('takes the CSRF token only from the server session answer', async () => {
    await createToken({ name: 'ci', scopes: [] } as never).catch(() => undefined)
    expect(sent[0].headers.has('x-pyn-csrf')).toBe(false)
    await signIn({ username: 'ann', password: 'pw' })
    sent.length = 0
    await releaseLock({ owner: 'acme', name: 'game' }, 'a.bin')
    expect(sent[0].headers.get('x-pyn-csrf')).toBe('csrf-from-server')
  })

  it('sends no identity, role, permission or entitlement of its own', async () => {
    await signIn({ username: 'ann', password: 'pw' })
    sent.length = 0
    const repo = { owner: 'acme', name: 'game' }
    await fetchMe()
    await releaseLock(repo, 'a.bin')
    await forceUnlock(repo, 'a.bin', 'stuck')
    await createToken({ name: 'ci', scopes: [] } as never)
    expect(sent).toHaveLength(4)
    for (const r of sent) {
      expect([...r.headers.keys()].filter((h) => !ALLOWED_HEADERS.has(h))).toEqual([])
      expect(r.url).not.toMatch(/[?&](user|role|admin|permission|entitlement)/i)
      if (r.body) expect(claimKeys(JSON.parse(r.body))).toEqual([])
    }
  })

  it('leaves safe requests without the CSRF header', async () => {
    await signIn({ username: 'ann', password: 'pw' })
    sent.length = 0
    await fetchMe()
    expect(sent[0].headers.has('x-pyn-csrf')).toBe(false)
  })

  it('forgets the CSRF token on sign-out', async () => {
    await signIn({ username: 'ann', password: 'pw' })
    await signOut()
    sent.length = 0
    await releaseLock({ owner: 'acme', name: 'game' }, 'a.bin')
    expect(sent[0].headers.has('x-pyn-csrf')).toBe(false)
  })
})

describe('gated controls', () => {
  afterEach(() => vi.unstubAllGlobals())

  function mountLocks(permissions: string[], answer: Response) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) =>
        init.method === 'POST' ? answer.clone() : json([]),
      ),
    )
    return mount(RepoLocksView, {
      global: {
        provide: {
          // The user is the owner and a server admin: neither may widen what `permissions` says.
          [sessionKey as symbol]: { user: ref('acme'), admin: ref(true), expire: vi.fn() },
          [repoKey as symbol]: {
            target: computed(() => ({ owner: 'acme', name: 'game' })),
            repo: ref(null),
            permissions: ref(permissions),
            org: ref(null),
            reload: vi.fn(),
          },
        },
      },
    })
  }

  it('derives the force-unlock control from the repository permissions answer only', async () => {
    const without = mountLocks(['read'], json({}))
    await flushPromises()
    expect(without.findComponent(PynLocks).props('canForce')).toBe(false)
    const withIt = mountLocks(['read', 'force_unlock'], json({}))
    await flushPromises()
    expect(withIt.findComponent(PynLocks).props('canForce')).toBe(true)
  })

  it.each([
    [403, 'forbidden', 'missing permission force_unlock'],
    [404, 'lock_not_found', 'no such lock'],
    [409, 'repo_frozen', 'the repository is frozen'],
    [403, 'limit_reached', 'storage limit reached'],
  ])(
    'shows the server refusal (%i %s) although the control was visible',
    async (status, code, message) => {
      const w = mountLocks(['read', 'force_unlock'], json({ code, message }, status))
      await flushPromises()
      const locks = w.findComponent(PynLocks)
      expect(locks.props('canForce')).toBe(true)
      locks.vm.$emit('force-unlock', { path: 'a.bin', reason: 'stuck' })
      await flushPromises()
      expect(locks.props('error')).toBe(message)
    },
  )
})

describe('what the client can change', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f)
      return statSync(p).isDirectory() ? files(p) : [p]
    })
  const sources = files('src')
    .filter((p) => /\.(ts|vue)$/.test(p) && !p.endsWith('schema.gen.ts'))
    .map((p) => [p, readFileSync(p, 'utf8')] as const)

  it('keeps nothing the server trusts in browser storage or script-readable cookies', () => {
    for (const [p, text] of sources)
      expect(text, p).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/)
  })

  it('uses no request header other than the CSRF token', () => {
    for (const [p, text] of sources) {
      const names = [...text.matchAll(/['"](X-[A-Za-z-]+|Authorization)['"]/g)].map((m) => m[1])
      expect(
        names.filter((n) => n !== 'X-Pyn-CSRF'),
        p,
      ).toEqual([])
    }
  })

  it('reads the CSRF token from the session answer in one place', () => {
    const setters = sources.filter(([, t]) => /setCsrfToken\(/.test(t)).map(([p]) => p)
    expect(setters.sort()).toEqual(['src/api/auth.ts', 'src/state/csrf.state.ts'])
  })
})
