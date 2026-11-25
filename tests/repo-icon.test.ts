import { PynRepoIconUpload, PynRepoList } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { routerKey } from 'vue-router'
import { ApiError } from '../src/api/client'
import { removeRepoIcon, uploadRepoIcon } from '../src/api/repos'
import { repoKey, sessionKey } from '../src/state/context.state'
import { describeIconError } from '../src/state/repo-icon.state'
import type { RepoDetails } from '../src/types/repo.types'
import ExploreView from '../src/views/ExploreView.vue'
import RepoGeneralView from '../src/views/RepoGeneralView.vue'
import { sampleRepos } from './fixtures/shell-data'

const r = { owner: 'alice', name: 'castle-quest' }
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 255, 13, 10])
const icon = '/v1/repos/alice/castle-quest/icon?v=0123456789abcdef'
const base: RepoDetails = sampleRepos[0]!

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function stub(res: (url: string, init?: RequestInit) => Response) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => res(url, init))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('repository icon API', () => {
  it('puts the image bytes with their type and answers the repository', async () => {
    const f = stub(() => json({ ...base, icon_url: icon }))
    const repo = await uploadRepoIcon(r, new File([png], 'i.png', { type: 'image/png' }))
    expect(repo.icon_url).toBe(icon)
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe('/v1/repos/alice/castle-quest/icon')
    expect(init?.method).toBe('PUT')
    expect(new Headers(init?.headers).get('Content-Type')).toBe('image/png')
    expect(Array.from(new Uint8Array(await new Response(init?.body).arrayBuffer()))).toEqual(
      Array.from(png),
    )
  })

  it('deletes the icon and answers the repository', async () => {
    const f = stub(() => json({ ...base, icon_url: null }))
    expect((await removeRepoIcon(r)).icon_url).toBeNull()
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe('/v1/repos/alice/castle-quest/icon')
    expect(init?.method).toBe('DELETE')
  })

  it('turns a refusal into an ApiError', async () => {
    stub(() => json({ code: 'unsupported_image', message: 'no' }, 415))
    await expect(uploadRepoIcon(r, new File([png], 'i.gif'))).rejects.toEqual(
      new ApiError(415, 'unsupported_image', 'no'),
    )
  })
})

describe('icon error wording', () => {
  it('words the size and format refusals, the rest as everywhere', () => {
    expect(describeIconError(new ApiError(413, 'object_too_large', 'x'))).toMatch(/1 MiB/)
    expect(describeIconError(new ApiError(415, 'unsupported_image', 'x'))).toMatch(/PNG/)
    expect(describeIconError(new ApiError(429, 'too_many_attempts', 'x', 60))).toMatch(
      /^Too many attempts/,
    )
    expect(describeIconError(new ApiError(403, 'not_namespace_owner', 'x'))).toMatch(
      /repository owner/,
    )
  })
})

function mountSettings(repo: RepoDetails, frozen = false) {
  const current = ref<RepoDetails | null>(repo)
  const w = mount(RepoGeneralView, {
    global: {
      provide: {
        [routerKey as symbol]: { replace: vi.fn(), push: vi.fn() },
        [sessionKey as symbol]: { user: ref('alice'), admin: ref(false), expire: vi.fn() },
        [repoKey as symbol]: {
          target: computed(() => r),
          repo: current,
          permissions: ref(['read']),
          org: ref(null),
          frozen: ref(frozen),
          ownerAvatar: ref('/v1/users/alice/avatar?v=1'),
          reload: vi.fn(),
        },
      },
    },
  })
  return { w, current, upload: () => w.findComponent(PynRepoIconUpload) }
}

describe('repository settings icon', () => {
  it('passes the icon and the owner avatar that stands in for it', async () => {
    stub(() => json([]))
    const { upload } = mountSettings({ ...base, icon_url: icon })
    await flushPromises()
    expect(upload().props()).toMatchObject({
      owner: 'alice',
      iconUrl: icon,
      ownerAvatarUrl: '/v1/users/alice/avatar?v=1',
      readonly: false,
      error: '',
    })
  })

  it('uploads and clears, keeping the answered repository', async () => {
    const f = stub((url, init) => {
      if (url.endsWith('/icon'))
        return json({ ...base, icon_url: init?.method === 'PUT' ? icon : null })
      return json([])
    })
    const { upload, current } = mountSettings(base)
    await flushPromises()
    upload().vm.$emit('upload', new File([png], 'i.png', { type: 'image/png' }))
    // The File body is read before the request goes out, which takes more than a microtask.
    await vi.waitFor(() => expect(current.value?.icon_url).toBe(icon))
    expect(upload().props('iconUrl')).toBe(icon)
    upload().vm.$emit('clear')
    await flushPromises()
    expect(current.value?.icon_url).toBeNull()
    const methods = f.mock.calls.filter(([u]) => u.endsWith('/icon')).map(([, i]) => i?.method)
    expect(methods).toEqual(['PUT', 'DELETE'])
  })

  it('shows a refusal under the upload and keeps the repository', async () => {
    stub((url) =>
      url.endsWith('/icon')
        ? json({ code: 'object_too_large', message: 'the object is larger' }, 413)
        : json([]),
    )
    const { upload, current } = mountSettings({ ...base, icon_url: icon })
    await flushPromises()
    upload().vm.$emit('upload', new File([png], 'big.png', { type: 'image/png' }))
    await vi.waitFor(() => expect(upload().props('error')).toMatch(/1 MiB/))
    expect(upload().props('busy')).toBe(false)
    expect(current.value?.icon_url).toBe(icon)
  })

  it('is read-only for a frozen owner', async () => {
    stub(() => json([]))
    const { upload } = mountSettings(base, true)
    await flushPromises()
    expect(upload().props('readonly')).toBe(true)
  })
})

describe('Explore rows', () => {
  it('carry each repository icon, null without one', async () => {
    stub(() => json({ repos: [{ ...base, icon_url: icon }, sampleRepos[1]], next_after: null }))
    const w = mount(ExploreView)
    await flushPromises()
    const rows = w.findComponent(PynRepoList).props('repos')
    expect(rows.map((x: { icon_url?: string | null }) => x.icon_url)).toEqual([icon, null])
  })
})
