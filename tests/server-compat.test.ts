import { PynViewNotice } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { onPendingDeletion } from '../src/state/pending.state'
import { compareVersions, minServerVersion, serverTooOld } from '../src/state/server-compat.state'

describe('compareVersions', () => {
  it('compares X.Y.Z numerically', () => {
    expect(compareVersions('0.1.4', '0.1.5')).toBe(-1)
    expect(compareVersions('0.1.10', '0.1.9')).toBe(1)
    expect(compareVersions('1.0.0', '0.9.9')).toBe(1)
    expect(compareVersions('0.1.5', '0.1.5')).toBe(0)
  })

  it('ignores a pre-release suffix and a leading v', () => {
    expect(compareVersions('0.1.5-alpha', '0.1.5')).toBe(0)
    expect(compareVersions('v0.1.6-rc1', '0.1.5')).toBe(1)
    expect(compareVersions('0.1.4-alpha', '0.1.5')).toBe(-1)
  })

  it('is null for anything that is not a version', () => {
    expect(compareVersions('', '0.1.5')).toBeNull()
    expect(compareVersions('dev', '0.1.5')).toBeNull()
    expect(compareVersions('0.1', '0.1.5')).toBeNull()
  })
})

describe('serverTooOld', () => {
  it('is true only for a strictly older server', () => {
    expect(serverTooOld('0.1.4', '0.1.5')).toBe(true)
    expect(serverTooOld('0.1.5', '0.1.5')).toBe(false)
    expect(serverTooOld('0.2.0', '0.1.5')).toBe(false)
  })

  it('is false for a pre-release of an equal or newer version', () => {
    expect(serverTooOld('0.1.5-alpha', '0.1.5')).toBe(false)
    expect(serverTooOld('0.1.6-alpha', '0.1.5')).toBe(false)
  })

  it('is false when the server reports no or an unreadable version', () => {
    expect(serverTooOld(undefined, '0.1.5')).toBe(false)
    expect(serverTooOld('', '0.1.5')).toBe(false)
    expect(serverTooOld('weird', '0.1.5')).toBe(false)
  })

  it('reads the minimum from min-server.json', () => {
    expect(minServerVersion).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

async function openWith(serverVersion: string | undefined) {
  const routes: Record<string, unknown> = {
    '/v1/setup': { initialised: true },
    '/v1/registration': { registration: 'closed' },
    '/v1/session': { user: 'wendy', csrf_token: 't' },
    '/v1/me': { id: 'a', user: 'wendy', admin: false },
    '/v1/repos': [],
    '/v1/orgs': [],
    '/v1/invitations': [],
    '/v1/account/deletion': { window_days: 30, pending: false, user: 'wendy' },
    '/v1/capabilities': { local_commits: true, version: serverVersion, revision: 'abc' },
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const body = routes[url.split('?')[0]]
      return Promise.resolve(
        body === undefined ? reply(404, { code: 'not_found', message: 'x' }) : reply(200, body),
      )
    }),
  )
  const router = makeRouter(createMemoryHistory())
  await router.push('/')
  await router.isReady()
  const { default: App } = await import('../src/App.vue')
  const w = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  return w
}

const notice = (w: Awaited<ReturnType<typeof openWith>>) =>
  w.findAllComponents(PynViewNotice).filter((n) => n.text().includes('pyn server'))

afterEach(() => {
  vi.unstubAllGlobals()
  onPendingDeletion(null)
})

describe('outdated server notice', () => {
  it('warns when the server is older than min_server', async () => {
    const w = await openWith('0.0.1')
    const [n] = notice(w)
    expect(n.props('tone')).toBe('warning')
    expect(n.text()).toContain(minServerVersion)
    expect(n.text()).toContain('0.0.1')
  })

  it('stays quiet for a newer server, no version, or an equal pre-release', async () => {
    for (const v of ['99.0.0', undefined, `${minServerVersion}-alpha`]) {
      expect(notice(await openWith(v))).toHaveLength(0)
    }
  })
})
