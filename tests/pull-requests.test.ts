import {
  PynCommentForm,
  PynPullRequestList,
  PynPullRequestPage,
} from '@avalon-initiative/pyn-common-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { makeRouter } from '../src/router'
import { repoKey, sessionKey } from '../src/state/context.state'
import {
  applyExpand,
  expandRange,
  readViewed,
  toDiffFile,
  viewedPaths,
  writeViewed,
} from '../src/state/pull-diff.state'
import {
  pullAbilities,
  pullListView,
  pullStatus,
  toPull,
  toPullSummary,
  withPullStatus,
} from '../src/state/pull.state'
import { withPolicyTabs } from '../src/state/repo-tabs.state'
import type { ServerDiffFile, ServerDiffHunk } from '../src/types/pull.types'
import RepoPullView from '../src/views/RepoPullView.vue'
import RepoPullsView from '../src/views/RepoPullsView.vue'

const who = (user: string) => ({ user })
const summary = (number: number, state = 'open', extra: object = {}) => ({
  number,
  title: `Change ${number}`,
  state,
  draft: false,
  author: who('bob'),
  base: 'main',
  head: `topic-${number}`,
  opened_at: '2026-11-01T10:00:00Z',
  comments: 0,
  ...extra,
})
const detail = (extra: object = {}) => ({
  ...summary(7),
  body: 'Why',
  commits: 2,
  changed_files: 1,
  additions: 3,
  deletions: 1,
  locks: [],
  participants: [who('bob')],
  base_commit: 'b'.repeat(40),
  head_commit: 'h'.repeat(40),
  outcome: 'merge',
  ...extra,
})

const context = (no: number, newNo: number) => ({
  kind: 'context' as const,
  old_no: no,
  new_no: newNo,
  text: `l${newNo}`,
})
const hunk = (old: number, nu: number, lines: ServerDiffHunk['lines'], extra = {}) => ({
  header: `@@ -${old},${lines.filter((l) => l.kind !== 'add').length} +${nu},${lines.filter((l) => l.kind !== 'delete').length} @@ fn`,
  old_start: old,
  old_lines: lines.filter((l) => l.kind !== 'add').length,
  new_start: nu,
  new_lines: lines.filter((l) => l.kind !== 'delete').length,
  lines,
  hidden_before: 0,
  hidden_after: 0,
  ...extra,
})
// Lines 1-9 hidden, a hunk at 10-12 (one line added after 10), 13-19 hidden, a hunk at 20-21, then 5 more.
const file = (): ServerDiffFile => ({
  path: 'src/a.rs',
  status: 'modified',
  additions: 1,
  deletions: 0,
  binary: false,
  too_large: false,
  mode: 'shared',
  file_mode: '100644',
  new_content: 'n1',
  old_content: 'o1',
  hunks: [
    hunk(10, 10, [context(10, 10), { kind: 'add', new_no: 11, text: 'new' }, context(11, 12)], {
      hidden_before: 9,
    }),
    hunk(19, 20, [context(19, 20), context(20, 21)], { hidden_before: 7, hidden_after: 5 }),
  ],
})

describe('pull request mapping', () => {
  it('maps a summary without review state or change counts', () => {
    const s = toPullSummary(summary(3, 'merged', { merged_at: '2026-11-02T10:00:00Z' }) as never)
    expect(s).toMatchObject({ number: 3, state: 'merged', review: 'none', additions: 0 })
    expect(s.href).toBeUndefined()
    expect(s.draft).toBe(false)
    expect(toPullSummary(summary(4, 'open', { draft: true }) as never).draft).toBe(true)
    expect(toPull(detail({ draft: true }) as never).draft).toBe(true)
  })

  it('maps the detail and leaves review fields unset', () => {
    const p = toPull(
      detail({ outcome: null, conflicts: [{ path: 'a', kind: 'content' }] }) as never,
    )
    expect(p).toMatchObject({ additions: 3, deletions: 1, commits: 2, changed_files: 1 })
    expect(p.outcome).toBeUndefined()
    expect(p.conflicts).toEqual([{ path: 'a', kind: 'content' }])
    expect(p.approvals).toBeUndefined()
    expect(p.threads).toBeUndefined()
  })

  it('maps diff files to the library shape', () => {
    const f = toDiffFile({ ...file(), old_path: 'src/old.rs', too_large: true })
    expect(f).toMatchObject({ oldPath: 'src/old.rs', tooLarge: true, mode: 'shared', lock: null })
    expect(f.hunks[0]).toMatchObject({ hiddenBefore: 9, hiddenAfter: 0 })
    expect(f.hunks[0]!.lines[1]).toEqual({ kind: 'add', oldNo: undefined, newNo: 11, text: 'new' })
  })
})

describe('pull request list query', () => {
  const all = [
    toPullSummary(summary(1) as never),
    toPullSummary(summary(2, 'merged') as never),
    toPullSummary(summary(3, 'closed', { author: who('carol') }) as never),
  ]

  it('reads the tab from is: and rewrites it', () => {
    expect(pullStatus('is:open')).toBe('open')
    expect(pullStatus('is:merged fix')).toBe('closed')
    expect(pullStatus('fix')).toBe('open')
    expect(withPullStatus('fix is:open author:bob', 'closed')).toBe('is:closed fix author:bob')
    expect(withPullStatus('is:draft is:merged', 'open')).toBe('is:open is:draft')
  })

  it('filters by tab and qualifiers and counts both tabs', () => {
    expect(pullListView(all, 'is:open').rows.map((p) => p.number)).toEqual([1])
    expect(pullListView(all, 'is:closed').rows.map((p) => p.number)).toEqual([2, 3])
    const carol = pullListView(all, 'is:closed author:carol')
    expect(carol.rows.map((p) => p.number)).toEqual([3])
    expect(carol.counts).toEqual({ open: 0, closed: 1 })
  })
})

describe('pull request abilities', () => {
  it('lets the author manage and checkin merge, and nobody on a frozen owner', () => {
    expect(pullAbilities(['read'], 'bob', 'bob', false)).toEqual({
      canMerge: false,
      canManage: true,
      canOverrideLocks: false,
      canComment: true,
    })
    expect(pullAbilities(['read', 'checkin'], 'al', 'bob', false).canMerge).toBe(true)
    expect(pullAbilities(['read'], 'al', 'bob', false).canManage).toBe(false)
    expect(pullAbilities(['read', 'checkin'], 'bob', 'bob', true)).toEqual({
      canMerge: false,
      canManage: false,
      canOverrideLocks: false,
      canComment: false,
    })
  })

  it('lets checkin with force_unlock merge over locks, and only a signed-in reader comment', () => {
    expect(pullAbilities(['read', 'checkin', 'force_unlock'], 'al', 'bob', false)).toMatchObject({
      canOverrideLocks: true,
    })
    expect(pullAbilities(['read', 'force_unlock'], 'al', 'bob', false).canOverrideLocks).toBe(false)
    expect(pullAbilities(['read'], '', 'bob', false).canComment).toBe(false)
  })
})

describe('diff expand', () => {
  it('loads the lines above the first hunk, joining them to it', () => {
    const f = file()
    const up = { path: f.path, hunk: 0, direction: 'up' as const, position: 'before' as const }
    expect(expandRange(f, up)).toEqual({ start: 1, end: 9 })
    const next = applyExpand(f, up, 1, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])
    expect(next.hunks[0]).toMatchObject({ old_start: 1, new_start: 1, hidden_before: 0 })
    expect(next.hunks[0]!.lines[0]).toEqual({ kind: 'context', old_no: 1, new_no: 1, text: 'a' })
    expect(next.hunks[0]!.header).toBe('@@ -1,11 +1,12 @@ fn')
  })

  it('loads part of a gap from either side with the old numbers offset', () => {
    const f = file()
    f.hunks[1]!.hidden_after = 0
    const down = { path: f.path, hunk: 1, direction: 'down' as const, position: 'before' as const }
    expect(expandRange(f, down, 3)).toEqual({ start: 13, end: 15 })
    const d = applyExpand(f, down, 13, ['x', 'y', 'z'])
    expect(d.hunks[0]!.lines.at(-1)).toEqual({ kind: 'context', old_no: 14, new_no: 15, text: 'z' })
    expect(d.hunks[1]!.hidden_before).toBe(4)
    const up = { path: f.path, hunk: 1, direction: 'up' as const, position: 'before' as const }
    expect(expandRange(d, up, 3)).toEqual({ start: 17, end: 19 })
    const u = applyExpand(d, up, 17, ['p', 'q', 'r'])
    expect(u.hunks[1]).toMatchObject({ old_start: 16, new_start: 17, hidden_before: 1 })
  })

  it('joins two hunks once the gap between them is loaded', () => {
    const f = file()
    const all = { path: f.path, hunk: 1, direction: 'all' as const, position: 'before' as const }
    expect(expandRange(f, all)).toEqual({ start: 13, end: 19 })
    const j = applyExpand(f, all, 13, ['1', '2', '3', '4', '5', '6', '7'])
    expect(j.hunks).toHaveLength(1)
    expect(j.hunks[0]).toMatchObject({ old_lines: 11, new_lines: 12, hidden_after: 5 })
    expect(j.hunks[0]!.lines.map((l) => l.new_no)).toEqual([
      10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    ])
  })

  it('starts an empty side at its first line once context is added', () => {
    const f = file()
    f.hunks = [
      hunk(10, 11, [{ kind: 'add', new_no: 11, text: 'new' }], { old_start: 10, hidden_after: 5 }),
    ]
    const down = { path: f.path, hunk: 0, direction: 'down' as const, position: 'after' as const }
    const t = applyExpand(f, down, 12, ['a', 'b'])
    expect(t.hunks[0]!.lines.at(-1)).toMatchObject({ old_no: 12, new_no: 13 })
    expect(t.hunks[0]!.header).toBe('@@ -11,2 +11,3 @@ fn')
  })

  it('loads the gap above the last hunk from its own controls despite trailing lines', () => {
    const f = file()
    const down = { path: f.path, hunk: 1, direction: 'down' as const, position: 'before' as const }
    expect(expandRange(f, down, 3)).toEqual({ start: 13, end: 15 })
  })

  it('ignores an after control that is not below the last hunk or has nothing hidden', () => {
    const f = file()
    const after = { path: f.path, hunk: 0, direction: 'down' as const, position: 'after' as const }
    expect(expandRange(f, after)).toBeNull()
    expect(applyExpand(f, after, 13, ['x'])).toBe(f)
    f.hunks[1]!.hidden_after = 0
    expect(expandRange(f, { ...after, hunk: 1 })).toBeNull()
  })

  it('loads the trailing lines after the last hunk', () => {
    const f = file()
    const down = { path: f.path, hunk: 1, direction: 'down' as const, position: 'after' as const }
    expect(expandRange(f, down)).toEqual({ start: 22, end: 26 })
    const t = applyExpand(f, down, 22, ['a', 'b', 'c', 'd', 'e'])
    expect(t.hunks[1]).toMatchObject({ hidden_after: 0, new_lines: 7 })
    expect(t.hunks[1]!.lines.at(-1)).toMatchObject({ old_no: 25, new_no: 26 })
  })
})

describe('viewed marks', () => {
  afterEach(() => localStorage.clear())

  it('keeps a mark only while the file is unchanged', () => {
    const f = file()
    writeViewed('acme/game#7', [f.path], [f])
    expect(viewedPaths(readViewed('acme/game#7'), [f])).toEqual([f.path])
    expect(viewedPaths(readViewed('acme/game#7'), [{ ...f, new_content: 'n2' }])).toEqual([])
    writeViewed('acme/game#7', [], [f])
    expect(localStorage.getItem('pyn.pull-viewed.acme/game#7')).toBeNull()
  })
})

describe('repository tabs', () => {
  it('puts Pull requests after Code', () => {
    const tabs = withPolicyTabs([
      { section: '', label: 'Code' },
      { section: 'locks', label: 'Locks' },
    ])
    expect(tabs[1]).toEqual({ section: 'pulls', label: 'Pull requests', icon: 'pull-request' })
  })
})

type Reply = (url: string, init?: RequestInit) => unknown

async function mountAt(
  url: string,
  component: typeof RepoPullView | typeof RepoPullsView,
  reply: Reply,
  opts: { permissions?: string[]; user?: string } = {},
) {
  const calls: { url: string; method: string; body?: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((u: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push({ url: u, method, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      const out = reply(u, init)
      if (out instanceof Promise) return out
      return Promise.resolve(
        out instanceof Response ? out : new Response(JSON.stringify(out ?? {}), { status: 200 }),
      )
    }),
  )
  const router = makeRouter(createMemoryHistory())
  await router.push(url)
  const reloadBranches = vi.fn(() => Promise.resolve())
  const name = ref('game')
  const w = mount(component, {
    global: {
      plugins: [router],
      provide: {
        [sessionKey as symbol]: {
          user: ref(opts.user ?? 'al'),
          admin: ref(false),
          expire: vi.fn(),
        },
        [repoKey as symbol]: {
          target: computed(() => ({ owner: 'acme', name: name.value })),
          permissions: ref(opts.permissions ?? ['read', 'checkin']),
          frozen: ref(false),
          locks: ref(null),
          reloadBranches,
        },
      },
    },
  })
  await flushPromises()
  return { w, calls, router, reloadBranches, name }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('pull request list page', () => {
  it('reads every page and shows the open ones with links', async () => {
    const { w, calls } = await mountAt('/acme/game/pulls', RepoPullsView, (u) =>
      u.includes('before=')
        ? { pulls: [summary(1, 'closed')], next_before: null }
        : { pulls: [summary(3), summary(2, 'merged')], next_before: 2 },
    )
    expect(calls.map((c) => c.url)).toEqual([
      '/v1/repos/acme/game/pulls?limit=100',
      '/v1/repos/acme/game/pulls?before=2&limit=100',
    ])
    const list = w.findComponent(PynPullRequestList)
    expect(list.props('pulls').map((p: { number: number }) => p.number)).toEqual([3])
    expect(list.props('pulls')[0].href).toBe('/acme/game/pulls/3')
    expect(list.props('counts')).toEqual({ open: 1, closed: 2 })
    expect(list.props('status')).toBe('open')
  })

  it('reloads for another repository and follows the address', async () => {
    const { w, name, router } = await mountAt('/acme/game/pulls', RepoPullsView, (u) => ({
      pulls: u.includes('/tools/') ? [summary(5)] : [summary(3)],
      next_before: null,
    }))
    name.value = 'tools'
    await flushPromises()
    const list = w.findComponent(PynPullRequestList)
    expect(list.props('pulls')[0].href).toBe('/acme/tools/pulls/5')
    await router.push('/acme/tools/pulls?q=is:closed')
    await flushPromises()
    expect(list.props('query')).toBe('is:closed')
    expect(list.props('status')).toBe('closed')
  })

  it('switches tabs through the is: qualifier in the address', async () => {
    const { w, router } = await mountAt('/acme/game/pulls?q=is:closed', RepoPullsView, () => ({
      pulls: [summary(3), summary(2, 'merged')],
      next_before: null,
    }))
    const list = w.findComponent(PynPullRequestList)
    expect(list.props('status')).toBe('closed')
    list.vm.$emit('update:status', 'open')
    await flushPromises()
    expect(list.props('query')).toBe('is:open')
    expect(router.currentRoute.value.query.q).toBeUndefined()
  })
})

describe('pull request page', () => {
  const routes =
    (pull: object, extra: Reply = () => undefined): Reply =>
    (u, init) =>
      extra(u, init) ??
      (u.endsWith('/events?limit=100')
        ? [{ id: '1', kind: 'comment', actor: who('al'), at: '2026-11-01T11:00:00Z', body: 'ok' }]
        : u.endsWith('/commits')
          ? [
              {
                id: 'c'.repeat(40),
                message: 'Work',
                author: who('bob'),
                committed_at: '2026-11-01T10:00:00Z',
              },
            ]
          : u.endsWith('/diff')
            ? {
                base: 'main',
                base_commit: 'b'.repeat(40),
                head: 'topic-7',
                head_commit: 'h'.repeat(40),
                from_commit: 'b'.repeat(40),
                files: [file()],
                truncated: false,
              }
            : u.includes('/lines?')
              ? {
                  path: 'src/a.rs',
                  commit: 'h',
                  revision: 1,
                  total: 26,
                  start: 22,
                  lines: ['a', 'b'],
                }
              : pull)

  it('shows the overview with the timeline and the viewer abilities', async () => {
    const { w, calls } = await mountAt('/acme/game/pulls/7', RepoPullView, routes(detail()))
    const page = w.findComponent(PynPullRequestPage)
    expect(page.props('tab')).toBe('overview')
    expect(page.props('basePath')).toBe('/acme/game/pulls/7')
    expect(page.props('events')).toHaveLength(1)
    expect(page.props('canMerge')).toBe(true)
    expect(page.props('canManage')).toBe(true)
    expect(calls.map((c) => c.url)).toEqual([
      '/v1/repos/acme/game/pulls/7',
      '/v1/repos/acme/game/pulls/7/events?limit=100',
    ])
  })

  it('hides merge and editing from a reader', async () => {
    const { w } = await mountAt('/acme/game/pulls/7', RepoPullView, routes(detail()), {
      permissions: ['read'],
    })
    const page = w.findComponent(PynPullRequestPage)
    expect(page.props('canMerge')).toBe(false)
    expect(page.props('canManage')).toBe(false)
    expect(page.props('editable')).toBe(false)
    expect(page.props('canOverrideLocks')).toBe(false)
  })

  it('shows a draft in the notices and marks it ready from the merge box', async () => {
    let answer!: (r: Response) => void
    const { w, calls } = await mountAt(
      '/acme/game/pulls/7',
      RepoPullView,
      routes(detail({ draft: true }), (u, init) =>
        init?.method === 'PATCH' ? new Promise<Response>((r) => (answer = r)) : undefined,
      ),
      { user: 'bob', permissions: ['read'] },
    )
    const page = w.findComponent(PynPullRequestPage)
    expect(page.props('pull').draft).toBe(true)
    expect(page.props('canMarkReady')).toBe(true)
    expect(w.text()).toContain('This pull request is a draft')
    page.vm.$emit('ready')
    await flushPromises()
    expect(page.props('merging')).toBe(true)
    const patch = calls.find((c) => c.method === 'PATCH')!
    expect(patch.url).toBe('/v1/repos/acme/game/pulls/7')
    expect(patch.body).toEqual({ draft: false })
    answer(new Response(JSON.stringify(detail({ draft: false }))))
    await flushPromises()
    expect(page.props('merging')).toBe(false)
    expect(page.props('pull').draft).toBe(false)
    expect(w.text()).not.toContain('This pull request is a draft')
  })

  it('lets a checkin with force_unlock merge over locks', async () => {
    const { w } = await mountAt('/acme/game/pulls/7', RepoPullView, routes(detail()), {
      permissions: ['read', 'checkin', 'force_unlock'],
    })
    expect(w.findComponent(PynPullRequestPage).props('canOverrideLocks')).toBe(true)
  })

  it('saves the title and the description', async () => {
    const { w, calls } = await mountAt(
      '/acme/game/pulls/7',
      RepoPullView,
      routes(detail(), (u, init) =>
        init?.method === 'PATCH'
          ? detail(JSON.parse(String(init.body)) as Record<string, string>)
          : undefined,
      ),
    )
    const page = w.findComponent(PynPullRequestPage)
    expect(page.props('editable')).toBe(true)
    page.vm.$emit('saveTitle', 'Better')
    await flushPromises()
    expect(calls.at(-1)).toMatchObject({ method: 'PATCH', body: { title: 'Better' } })
    expect(page.props('pull').title).toBe('Better')
    page.vm.$emit('saveBody', 'More')
    await flushPromises()
    expect(calls.at(-1)).toMatchObject({ method: 'PATCH', body: { body: 'More' } })
    expect(page.props('pull').body).toBe('More')
  })

  it('shows a refused title on the editor', async () => {
    const { w } = await mountAt(
      '/acme/game/pulls/7',
      RepoPullView,
      routes(detail(), (u, init) =>
        init?.method === 'PATCH'
          ? new Response(JSON.stringify({ code: 'invalid_request', message: 'bad title' }), {
              status: 400,
            })
          : undefined,
      ),
    )
    const page = w.findComponent(PynPullRequestPage)
    page.vm.$emit('saveTitle', '')
    await flushPromises()
    expect(page.props('titleError')).toBeTruthy()
    expect(page.props('titleSaving')).toBe(false)
    page.vm.$emit('editTitle')
    await flushPromises()
    expect(page.props('titleError')).toBeUndefined()
  })

  const comment = { id: '2', kind: 'comment', actor: who('al'), at: '2026-11-02T11:00:00Z' }

  it('posts a comment, adds it to the timeline and clears the form', async () => {
    const { w, calls } = await mountAt(
      '/acme/game/pulls/7',
      RepoPullView,
      routes(detail(), (u, init) =>
        init?.method === 'POST' ? { ...comment, body: 'Looks good' } : undefined,
      ),
    )
    const form = w.findComponent(PynCommentForm)
    expect(form.props('canClose')).toBe(true)
    form.vm.$emit('update:modelValue', 'Looks good')
    form.vm.$emit('submit', 'Looks good')
    await flushPromises()
    expect(calls.at(-1)).toMatchObject({
      method: 'POST',
      url: '/v1/repos/acme/game/pulls/7/comments',
      body: { body: 'Looks good' },
    })
    expect(form.props('modelValue')).toBe('')
    const page = w.findComponent(PynPullRequestPage)
    expect(page.props('events')).toHaveLength(2)
    expect(page.props('pull').comments).toBe(1)
  })

  it('keeps the draft when a comment is refused', async () => {
    const { w } = await mountAt(
      '/acme/game/pulls/7',
      RepoPullView,
      routes(detail(), (u, init) =>
        init?.method === 'POST'
          ? new Response(JSON.stringify({ code: 'invalid_request', message: 'empty' }), {
              status: 400,
            })
          : undefined,
      ),
    )
    const form = w.findComponent(PynCommentForm)
    form.vm.$emit('update:modelValue', 'x')
    form.vm.$emit('submit', 'x')
    await flushPromises()
    expect(form.props('modelValue')).toBe('x')
    expect(form.props('error')).toBeTruthy()
  })

  it('comments and then closes for close with comment', async () => {
    const { w, calls } = await mountAt(
      '/acme/game/pulls/7',
      RepoPullView,
      routes(detail(), (u, init) =>
        init?.method !== 'POST'
          ? undefined
          : u.endsWith('/comments')
            ? { ...comment, body: 'Done' }
            : detail({ state: 'closed' }),
      ),
    )
    w.findComponent(PynCommentForm).vm.$emit('close', 'Done')
    await flushPromises()
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual([
      '/v1/repos/acme/game/pulls/7/comments',
      '/v1/repos/acme/game/pulls/7/close',
    ])
    expect(w.findComponent(PynPullRequestPage).props('pull').state).toBe('closed')
    expect(w.findComponent(PynCommentForm).props('canClose')).toBe(false)
  })

  it('closes without a comment when the text is empty, and hides the form when signed out', async () => {
    const { w, calls } = await mountAt(
      '/acme/game/pulls/7',
      RepoPullView,
      routes(detail(), (u, init) =>
        init?.method === 'POST' ? detail({ state: 'closed' }) : undefined,
      ),
    )
    w.findComponent(PynCommentForm).vm.$emit('close', '  ')
    await flushPromises()
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual([
      '/v1/repos/acme/game/pulls/7/close',
    ])
    const out = await mountAt('/acme/game/pulls/7', RepoPullView, routes(detail()), { user: '' })
    expect(out.w.findComponent(PynCommentForm).exists()).toBe(false)
  })

  it('merges with the method and the commits the page loaded', async () => {
    const { w, calls, reloadBranches } = await mountAt(
      '/acme/game/pulls/7',
      RepoPullView,
      routes(detail(), (u, init) =>
        init?.method === 'POST' ? detail({ state: 'merged', merge_commit: 'm' }) : undefined,
      ),
    )
    w.findComponent(PynPullRequestPage).vm.$emit('merge', 'never')
    await flushPromises()
    const post = calls.find((c) => c.method === 'POST')!
    expect(post.url).toBe('/v1/repos/acme/game/pulls/7/merge')
    expect(post.body).toEqual({
      fast_forward: 'never',
      expect_target: 'b'.repeat(40),
      expect_head: 'h'.repeat(40),
    })
    expect(w.findComponent(PynPullRequestPage).props('pull').state).toBe('merged')
    expect(reloadBranches).toHaveBeenCalled()
  })

  it('reloads and explains a merge refused for locks', async () => {
    const { w, calls } = await mountAt(
      '/acme/game/pulls/7',
      RepoPullView,
      routes(detail(), (u, init) =>
        init?.method === 'POST'
          ? new Response(JSON.stringify({ code: 'pull_locks_held', message: 'held' }), {
              status: 409,
            })
          : undefined,
      ),
    )
    w.findComponent(PynPullRequestPage).vm.$emit('merge', 'allow')
    await flushPromises()
    const page = w.findComponent(PynPullRequestPage)
    expect(page.props('mergeError')).toMatch(/holds locks/)
    expect(calls.filter((c) => c.url === '/v1/repos/acme/game/pulls/7')).toHaveLength(2)
  })

  it('drops a close that answers after moving to another pull request', async () => {
    let answer!: (r: Response) => void
    const { w, router } = await mountAt(
      '/acme/game/pulls/7',
      RepoPullView,
      routes(detail(), (u, init) =>
        init?.method === 'POST'
          ? new Promise<Response>((r) => (answer = r))
          : u.endsWith('/pulls/8')
            ? detail({ number: 8, title: 'Other' })
            : undefined,
      ),
    )
    w.findComponent(PynPullRequestPage).vm.$emit('close')
    await flushPromises()
    await router.push('/acme/game/pulls/8')
    await flushPromises()
    answer(
      new Response(JSON.stringify({ code: 'pull_request_not_open', message: 'x' }), {
        status: 409,
      }),
    )
    await flushPromises()
    const page = w.findComponent(PynPullRequestPage)
    expect(page.props('pull').number).toBe(8)
    expect(w.text()).not.toContain('no longer open')
  })

  it('closes a pull request', async () => {
    const { w, calls } = await mountAt(
      '/acme/game/pulls/7',
      RepoPullView,
      routes(detail(), (u, init) =>
        init?.method === 'POST' ? detail({ state: 'closed' }) : undefined,
      ),
    )
    w.findComponent(PynPullRequestPage).vm.$emit('close')
    await flushPromises()
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/pulls/7/close'))).toBe(true)
    expect(w.findComponent(PynPullRequestPage).props('pull').state).toBe('closed')
  })

  it('loads the commits on the commits tab', async () => {
    const { w } = await mountAt('/acme/game/pulls/7/commits', RepoPullView, routes(detail()))
    const page = w.findComponent(PynPullRequestPage)
    expect(page.props('tab')).toBe('commits')
    expect(page.props('commits')).toHaveLength(1)
  })

  it('shows the checks tab without a request of its own', async () => {
    const { w, calls } = await mountAt('/acme/game/pulls/7/checks', RepoPullView, routes(detail()))
    expect(w.findComponent(PynPullRequestPage).props('tab')).toBe('checks')
    expect(calls).toHaveLength(1)
  })

  it('loads the diff, remembers viewed files and expands hidden lines', async () => {
    const { w, calls } = await mountAt('/acme/game/pulls/7/files', RepoPullView, routes(detail()))
    const page = w.findComponent(PynPullRequestPage)
    expect(page.props('files')![0]!.path).toBe('src/a.rs')
    page.vm.$emit('update:viewed', ['src/a.rs'])
    await flushPromises()
    expect(page.props('viewed')).toEqual(['src/a.rs'])
    expect(readViewed('acme/game#7')).toEqual({ 'src/a.rs': 'n1' })
    page.vm.$emit('expand', { path: 'src/a.rs', hunk: 1, direction: 'down', position: 'after' })
    await flushPromises()
    expect(calls.at(-1)!.url).toBe(
      `/v1/repos/acme/game/lines?path=src%2Fa.rs&rev=${'h'.repeat(40)}&start=22&end=26`,
    )
    expect(page.props('files')![0]!.hunks[1]!.hiddenAfter).toBe(3)
    localStorage.clear()
  })
})
