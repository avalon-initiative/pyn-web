import { PynLoading } from '@avalon-initiative/pyn-common-ui'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import MyLocksView from '../src/views/MyLocksView.vue'
import OrgsView from '../src/views/OrgsView.vue'
import ReposView from '../src/views/ReposView.vue'

vi.mock('../src/api/orgs', () => ({ listMyOrgs: () => new Promise(() => {}) }))
vi.mock('../src/api/repos', () => ({
  listRepos: () => new Promise(() => {}),
  listMyLocks: () => new Promise(() => {}),
}))

const router = makeRouter(createMemoryHistory())

describe('loading states', () => {
  it.each([
    ['organizations', OrgsView],
    ['repositories', ReposView],
    ['locks', MyLocksView],
  ])('%s view shows a labelled PynLoading while fetching', (_name, view) => {
    const wrapper = mount(view, { global: { plugins: [router] } })
    const loading = wrapper.findComponent(PynLoading)
    expect(loading.exists()).toBe(true)
    expect(loading.html()).toMatch(/role="status"/)
    expect(loading.text()).toBe('Loading')
  })
})
