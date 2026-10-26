import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkin, fetchFileEntry, putObject } from '../src/api/repos'
import { ApiError } from '../src/api/client'
import {
  EDIT_POLICY,
  POLICY_PATH,
  policyConflict,
  usePolicyEditor,
} from '../src/state/policy.state'
import type { PolicyDeps } from '../src/state/policy.state'

const entry = (revision: number | null) => ({
  path: POLICY_PATH,
  mode: 'shared' as const,
  file_mode: '100644' as const,
  revision,
})

function setup(over: Partial<PolicyDeps> = {}, perms = [EDIT_POLICY]) {
  const deps: PolicyDeps = {
    entry: vi.fn().mockResolvedValue(entry(3)),
    read: vi.fn().mockResolvedValue('[rules]\n'),
    upload: vi.fn().mockResolvedValue('blob1'),
    checkin: vi.fn().mockResolvedValue({}),
    ...over,
  }
  return { deps, ed: usePolicyEditor(deps, () => perms) }
}

describe('policy editor state', () => {
  it('loads the text and head revision', async () => {
    const { deps, ed } = setup()
    await ed.load()
    expect(deps.read).toHaveBeenCalledWith(3)
    expect(ed.text.value).toBe('[rules]\n')
    expect(ed.revision.value).toBe(3)
    expect(ed.dirty.value).toBe(false)
  })

  it('starts empty with no base when the repository has no policy file', async () => {
    const { deps, ed } = setup({ entry: vi.fn().mockResolvedValue(null) })
    await ed.load()
    expect(deps.read).not.toHaveBeenCalled()
    ed.text.value = 'x'
    await ed.save('add')
    expect(deps.checkin).toHaveBeenCalledWith({
      path: POLICY_PATH,
      content: 'blob1',
      message: 'add',
    })
  })

  it('reports a failed load', async () => {
    const { ed } = setup({
      entry: vi.fn().mockRejectedValue(new ApiError(404, 'repo_not_found', 'x')),
    })
    await ed.load()
    expect(ed.loadError.value).toContain('does not exist')
  })

  it('tracks edits and discards them', async () => {
    const { ed } = setup()
    await ed.load()
    ed.text.value = 'changed'
    expect(ed.dirty.value).toBe(true)
    ed.discard()
    expect(ed.dirty.value).toBe(false)
  })

  it('uploads the text and checks in against the base revision, then reloads', async () => {
    const entryFn = vi.fn().mockResolvedValueOnce(entry(3)).mockResolvedValueOnce(entry(4))
    const read = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new')
    const { deps, ed } = setup({ entry: entryFn, read })
    await ed.load()
    ed.text.value = 'new'
    expect(await ed.save('Update policy')).toBe(true)
    expect(deps.upload).toHaveBeenCalledWith('new')
    expect(deps.checkin).toHaveBeenCalledWith({
      path: POLICY_PATH,
      content: 'blob1',
      message: 'Update policy',
      base_revision: 3,
    })
    expect(ed.revision.value).toBe(4)
    expect(ed.dirty.value).toBe(false)
  })

  it('refuses to save without edit_policy', async () => {
    const { deps, ed } = setup({}, ['checkin'])
    await ed.load()
    expect(ed.canEdit.value).toBe(false)
    expect(await ed.save('x')).toBe(false)
    expect(ed.conflict.value?.kind).toBe('forbidden')
    expect(deps.upload).not.toHaveBeenCalled()
  })

  it.each(['lock_required', 'lock_held', 'stale_base', 'invalid_rules'] as const)(
    'maps %s to a typed conflict and keeps the edits',
    async (code) => {
      const { ed } = setup({ checkin: vi.fn().mockRejectedValue(new ApiError(409, code, 'why')) })
      await ed.load()
      ed.text.value = 'mine'
      expect(await ed.save('x')).toBe(false)
      expect(ed.conflict.value).toEqual({ kind: code, message: 'why' })
      expect(ed.text.value).toBe('mine')
      expect(ed.saving.value).toBe(false)
    },
  )

  it('rebases onto the new head keeping the edited text', async () => {
    const entryFn = vi.fn().mockResolvedValueOnce(entry(3)).mockResolvedValueOnce(entry(5))
    const read = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('theirs')
    const { ed } = setup({ entry: entryFn, read })
    await ed.load()
    ed.text.value = 'mine'
    await ed.load(true)
    expect(ed.revision.value).toBe(5)
    expect(ed.text.value).toBe('mine')
    expect(ed.dirty.value).toBe(true)
  })

  it('classifies other failures', () => {
    expect(policyConflict(new ApiError(403, 'forbidden', 'no')).kind).toBe('forbidden')
    expect(policyConflict(new Error('down')).kind).toBe('error')
  })
})

describe('policy api calls', () => {
  const r = { owner: 'o', name: 'n' }
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
  afterEach(() => vi.unstubAllGlobals())

  it('finds the policy entry with a cursor just before its path', async () => {
    const fn = vi
      .fn()
      .mockResolvedValue(
        reply(200, { entries: [{ path: POLICY_PATH, revision: 2 }], next_after: null }),
      )
    vi.stubGlobal('fetch', fn)
    expect((await fetchFileEntry(r, POLICY_PATH))?.revision).toBe(2)
    const url = String(fn.mock.calls[0][0])
    expect(url).toContain('after=.pyn%2Fpyn.tom&limit=1')
  })

  it('has no entry when the next path is another file', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(reply(200, { entries: [{ path: 'a.txt' }], next_after: null })),
    )
    expect(await fetchFileEntry(r, POLICY_PATH)).toBeNull()
  })

  it('uploads the text and checks in, surfacing the error code', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(reply(200, { content: 'b1' }))
      .mockResolvedValueOnce(reply(409, { code: 'stale_base', message: 'moved' }))
    vi.stubGlobal('fetch', fn)
    expect(await putObject(r, 'x')).toBe('b1')
    expect(fn.mock.calls[0][1]).toMatchObject({ method: 'PUT', body: 'x' })
    const e = await checkin(r, { path: POLICY_PATH, content: 'b1', message: 'm' }).catch((x) => x)
    expect(policyConflict(e)).toEqual({ kind: 'stale_base', message: 'moved' })
  })
})
