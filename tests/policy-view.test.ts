import { PynPolicyConflictNotice, PynPolicyEditor } from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { ApiError } from '../src/api/client'
import * as repos from '../src/api/repos'
import { repoKey, sessionKey } from '../src/state/context.state'
import { EDIT_POLICY, POLICY_PATH } from '../src/state/policy.state'
import RepoPolicyView from '../src/views/RepoPolicyView.vue'

vi.mock('../src/api/repos')

const entry = (revision: number) => ({
  path: POLICY_PATH,
  mode: 'shared' as const,
  file_mode: '100644' as const,
  revision,
})

function content(text: string) {
  return { bytes: new TextEncoder().encode(text), truncated: false }
}

function mountView(permissions: string[] = [EDIT_POLICY]) {
  return mount(RepoPolicyView, {
    global: {
      provide: {
        [sessionKey as symbol]: { user: ref('ann'), admin: ref(false), expire: vi.fn() },
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

const editor = (w: ReturnType<typeof mountView>) => w.findComponent(PynPolicyEditor)
const notice = (w: ReturnType<typeof mountView>) => w.findComponent(PynPolicyConflictNotice)

async function edited(text = 'new') {
  const w = mountView()
  await flushPromises()
  editor(w).vm.$emit('update:text', text)
  await flushPromises()
  return w
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(repos.fetchFileEntry).mockResolvedValue(entry(3))
  vi.mocked(repos.fetchContent).mockResolvedValue(content('[rules]\n'))
  vi.mocked(repos.putObject).mockResolvedValue('blob1')
  vi.mocked(repos.checkin).mockResolvedValue({} as never)
})

describe('RepoPolicyView', () => {
  it('loads the policy on enter and tracks edits', async () => {
    const w = mountView()
    await flushPromises()
    expect(repos.fetchContent).toHaveBeenCalledWith(
      { owner: 'acme', name: 'game' },
      POLICY_PATH,
      expect.any(Number),
      3,
    )
    expect(editor(w).props()).toMatchObject({ text: '[rules]\n', headRevision: 3, dirty: false })
    editor(w).vm.$emit('update:text', 'changed')
    await flushPromises()
    expect(editor(w).props('dirty')).toBe(true)
    editor(w).vm.$emit('revert')
    await flushPromises()
    expect(editor(w).props()).toMatchObject({ text: '[rules]\n', dirty: false })
  })

  it('shows nothing without edit_policy and does not load', async () => {
    const w = mountView(['read'])
    await flushPromises()
    expect(editor(w).exists()).toBe(false)
    expect(repos.fetchFileEntry).not.toHaveBeenCalled()
  })

  it('saves against the loaded revision and reloads', async () => {
    const w = await edited()
    editor(w).vm.$emit('save')
    await flushPromises()
    expect(repos.putObject).toHaveBeenCalledWith({ owner: 'acme', name: 'game' }, 'new')
    expect(repos.checkin).toHaveBeenCalledWith(
      { owner: 'acme', name: 'game' },
      expect.objectContaining({ path: POLICY_PATH, content: 'blob1', base_revision: 3 }),
    )
    expect(notice(w).exists()).toBe(false)
  })

  it('takes the lock and retries the save on lock_required', async () => {
    vi.mocked(repos.checkin)
      .mockRejectedValueOnce(new ApiError(409, 'lock_required', 'lock it'))
      .mockResolvedValueOnce({} as never)
    vi.mocked(repos.checkout).mockResolvedValue({} as never)
    const w = await edited()
    editor(w).vm.$emit('save')
    await flushPromises()
    expect(notice(w).props('kind')).toBe('lock_required')
    notice(w).vm.$emit('takeLock')
    await flushPromises()
    expect(repos.checkout).toHaveBeenCalledWith({ owner: 'acme', name: 'game' }, POLICY_PATH, 3)
    expect(repos.checkin).toHaveBeenCalledTimes(2)
    expect(notice(w).exists()).toBe(false)
  })

  it('names the holder on lock_held', async () => {
    vi.mocked(repos.checkin).mockRejectedValue(new ApiError(409, 'lock_held', 'held'))
    vi.mocked(repos.listLocks).mockResolvedValue([
      { path: POLICY_PATH, owner: 'bob', acquired_at: '', expires_at: '' },
    ])
    const w = await edited()
    editor(w).vm.$emit('save')
    await flushPromises()
    expect(notice(w).props()).toMatchObject({ kind: 'lock_held', holder: 'bob' })
  })

  it('reloads on stale_base keeping the edited text, then discards', async () => {
    vi.mocked(repos.checkin).mockRejectedValue(new ApiError(409, 'stale_base', 'moved'))
    const w = await edited('mine')
    editor(w).vm.$emit('save')
    await flushPromises()
    expect(notice(w).props('kind')).toBe('stale_base')
    vi.mocked(repos.fetchFileEntry).mockResolvedValue(entry(4))
    notice(w).vm.$emit('reload')
    await flushPromises()
    expect(editor(w).props()).toMatchObject({ text: 'mine', headRevision: 4, dirty: true })
    expect(notice(w).exists()).toBe(true)
    notice(w).vm.$emit('discard')
    await flushPromises()
    expect(editor(w).props('text')).toBe('[rules]\n')
    expect(notice(w).exists()).toBe(false)
  })

  it('shows invalid rules as problems and dismisses the notice', async () => {
    vi.mocked(repos.checkin).mockRejectedValue(new ApiError(400, 'invalid_rules', 'bad glob'))
    const w = await edited()
    editor(w).vm.$emit('save')
    await flushPromises()
    expect(notice(w).props()).toMatchObject({
      kind: 'invalid_rules',
      problems: [{ message: 'bad glob' }],
    })
    notice(w).vm.$emit('dismiss')
    await flushPromises()
    expect(notice(w).exists()).toBe(false)
  })
})
