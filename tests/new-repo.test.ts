import { PynRepoForm, PynSettingsToggle } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { sessionKey } from '../src/state/context.state'
import { describeRepoNameError } from '../src/state/name.state'
import { ApiError } from '../src/api/client'
import NewRepoView from '../src/views/NewRepoView.vue'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const bodies: Record<string, unknown>[] = []
let createStatus = 201

afterEach(() => {
  vi.unstubAllGlobals()
  bodies.length = 0
  createStatus = 201
})

const mountView = async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (url === '/v1/repos' && method === 'POST') {
        bodies.push(JSON.parse(String(init?.body)))
        return Promise.resolve(
          createStatus === 201
            ? json({ id: 'r', owner: 'alice', name: 'test-repo' }, 201)
            : json({ code: 'repo_exists', message: 'x' }, 409),
        )
      }
      if (url === '/v1/me/orgs') return Promise.resolve(json([]))
      return Promise.resolve(json([]))
    }),
  )
  const router = makeRouter(createMemoryHistory())
  const w = mount(NewRepoView, {
    global: { plugins: [router], provide: { [sessionKey as symbol]: { user: ref('alice') } } },
  })
  await flushPromises()
  return w
}

describe('new repository form', () => {
  it('uses the numbered steps with a suggestion and a starter policy toggle on by default', async () => {
    const w = await mountView()
    const form = w.findComponent(PynRepoForm)
    expect(form.props('steps')).toBe(true)
    expect(form.props('describable')).toBe(true)
    expect(form.props('suggestion')).toMatch(/^[a-z]+-[a-z]+$/)
    expect(w.findComponent(PynSettingsToggle).props('modelValue')).toBe(true)
  })

  it('passes the outgoing name to the form while typing and none while empty', async () => {
    const w = await mountView()
    const form = w.findComponent(PynRepoForm)
    expect(form.props('nameCanonical')).toBeFalsy()
    form.vm.$emit('nameInput', 'Test Repo')
    await flushPromises()
    expect(form.props('nameCanonical')).toBe('test-repo')
    form.vm.$emit('nameInput', '  ')
    await flushPromises()
    expect(form.props('nameCanonical')).toBeFalsy()
  })

  it('sends starter_policy true by default and the canonical name', async () => {
    const w = await mountView()
    w.findComponent(PynRepoForm).vm.$emit('submit', {
      name: ' Test Repo ',
      visibility: 'private',
      lease_hours: 8,
    })
    await flushPromises()
    expect(bodies[0]).toMatchObject({ name: 'test-repo', starter_policy: true })
    expect(bodies[0]).not.toHaveProperty('starter_default')
  })

  it('sends starter_policy false when the toggle is off', async () => {
    const w = await mountView()
    w.findComponent(PynSettingsToggle).vm.$emit('update:modelValue', false)
    await flushPromises()
    w.findComponent(PynRepoForm).vm.$emit('submit', {
      name: 'game',
      visibility: 'private',
      lease_hours: 8,
    })
    await flushPromises()
    expect(bodies[0]).toMatchObject({ starter_policy: false })
  })

  it('reports a taken name against the name that was sent', async () => {
    createStatus = 409
    const w = await mountView()
    w.findComponent(PynRepoForm).vm.$emit('submit', {
      name: 'Test Repo',
      visibility: 'private',
      lease_hours: 8,
    })
    await flushPromises()
    expect(w.findComponent(PynRepoForm).props('error')).toContain(
      '"alice/test-repo" already exists',
    )
  })

  it('leaves other errors as they are', () => {
    const e = new ApiError(500, 'odd_code', 'nope')
    expect(describeRepoNameError(e, 'alice', 'x')).toBe('nope')
  })
})
