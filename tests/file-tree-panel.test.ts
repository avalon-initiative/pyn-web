import { PynFileView } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { ancestorFolders, toggled } from '../src/state/file-tree.state'
import { repoKey, sessionKey } from '../src/state/context.state'
import RepoBlobView from '../src/views/RepoBlobView.vue'

const rev = (path: string) => ({
  id: 1,
  path,
  author: 'bob',
  commit: 'a'.repeat(40),
  file_mode: '100644',
  hash: 'b'.repeat(64),
  hash_version: 1,
  message: 'm',
  content: 'c0ffee',
  created_at: '2026-10-01T00:00:00Z',
})
const file = (path: string) => ({
  name: path.split('/').pop(),
  path,
  kind: 'file',
  mode: 'shared',
  last_change: rev(path),
})
const folder = (path: string) => ({
  name: path.split('/').pop(),
  path,
  kind: 'folder',
  mode: 'shared',
})
const listings: Record<string, unknown[]> = {
  '': [folder('src'), folder('docs'), file('README.md')],
  src: [folder('src/deep'), file('src/a.ts')],
  'src/deep': [file('src/deep/b.ts')],
  docs: [file('docs/c.md')],
}
const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body)))

async function open(url: string, permissions = ['read', 'checkin']) {
  const calls: { url: string; method?: string; body?: string }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((u: string, init?: RequestInit) => {
      calls.push({ url: u, method: init?.method, body: init?.body as string | undefined })
      if (u.includes('/tree')) {
        const folderPath = new URL(u, 'http://x').searchParams.get('path') ?? ''
        return json({ path: folderPath, entries: listings[folderPath] ?? [] })
      }
      if (u.includes('/policy')) return json({ paths: [] })
      if (u.includes('/content')) return Promise.resolve(new Response('hello'))
      if (u.endsWith('/branches')) return json({ name: 'feature', default: false })
      return json({})
    }),
  )
  const selectBranch = vi.fn()
  const reloadBranches = vi.fn(() => Promise.resolve())
  const router = makeRouter(createMemoryHistory())
  await router.push(url)
  const w = mount(RepoBlobView, {
    global: {
      plugins: [router],
      provide: {
        [repoKey as symbol]: {
          target: ref({ owner: 'acme', name: 'game' }),
          permissions: ref(permissions),
          frozen: ref(false),
          branches: ref([{ name: 'main', isDefault: true }]),
          selectBranch,
          reloadBranches,
        },
        [sessionKey as symbol]: { user: ref('alice'), admin: ref(false) },
      },
    },
  })
  await flushPromises()
  return { w, calls, router, selectBranch, reloadBranches }
}

afterEach(() => vi.unstubAllGlobals())

describe('file tree helpers', () => {
  it('lists the folders above a path and toggles one', () => {
    expect(ancestorFolders('a/b/c.ts')).toEqual(['a', 'a/b'])
    expect(ancestorFolders('c.ts')).toEqual([])
    expect(toggled(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggled(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('file view tree panel', () => {
  it('loads the root and the folders above the open file, expanded', async () => {
    const { w } = await open('/acme/game/blob/src/deep/b.ts')
    const view = w.findComponent(PynFileView)
    expect(view.props('expanded')).toEqual(['src', 'src/deep'])
    expect(
      view
        .props('tree')!
        .map((e: { path: string }) => e.path)
        .sort(),
    ).toEqual(['README.md', 'docs', 'src', 'src/a.ts', 'src/deep', 'src/deep/b.ts'])
  })

  it('fetches a folder on its first expansion and keeps it on collapse', async () => {
    const { w, calls } = await open('/acme/game/blob/README.md')
    const view = w.findComponent(PynFileView)
    view.vm.$emit('toggleFolder', 'docs')
    await flushPromises()
    expect(view.props('expanded')).toContain('docs')
    expect(view.props('tree')!.some((e: { path: string }) => e.path === 'docs/c.md')).toBe(true)
    const fetched = calls.filter((c) => c.url.includes('path=docs')).length
    view.vm.$emit('toggleFolder', 'docs')
    view.vm.$emit('toggleFolder', 'docs')
    await flushPromises()
    expect(calls.filter((c) => c.url.includes('path=docs')).length).toBe(fetched)
  })

  it('opens a file from the panel on the current branch', async () => {
    const { w, router } = await open('/acme/game/blob/README.md?branch=feature')
    w.findComponent(PynFileView).vm.$emit('open', 'src/a.ts')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/acme/game/blob/src/a.ts?branch=feature')
  })

  it('switches branch and creates one from the current branch', async () => {
    const { w, calls, selectBranch, reloadBranches } = await open('/acme/game/blob/README.md')
    const view = w.findComponent(PynFileView)
    expect(view.props('creatable')).toBe(true)
    view.vm.$emit('selectBranch', 'main')
    expect(selectBranch).toHaveBeenCalledWith('main')
    view.vm.$emit('createBranch', 'feature')
    await flushPromises()
    const post = calls.find((c) => c.method === 'POST')
    expect(post!.url).toBe('/v1/repos/acme/game/branches')
    expect(JSON.parse(post!.body!)).toEqual({ name: 'feature' })
    expect(reloadBranches).toHaveBeenCalled()
    expect(selectBranch).toHaveBeenLastCalledWith('feature')
  })

  it('does not offer branch creation without the checkin permission', async () => {
    const { w } = await open('/acme/game/blob/README.md', ['read'])
    expect(w.findComponent(PynFileView).props('creatable')).toBe(false)
  })
})
