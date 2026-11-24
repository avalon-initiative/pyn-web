<script setup lang="ts">
import {
  PynCommentForm,
  PynLoading,
  PynPullRequestPage,
  PynViewError,
  PynViewNotice,
  repoPath,
} from '@avalon-initiative/pyn-common-ui'
import type {
  DiffExpand,
  DiffLayout,
  PullCommit,
  PullEvent,
  PullMergeMethod,
  PullTab,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '../api/client'
import {
  closePull,
  commentPull,
  fileLines,
  getPull,
  mergePull,
  pullCommits,
  pullDiff,
  pullEvents,
  reopenPull,
  updatePull,
} from '../api/pulls'
import { useAction } from '../state/action.state'
import { repoKey, sessionKey } from '../state/context.state'
import {
  applyExpand,
  expandRange,
  readLayout,
  readViewed,
  toDiffFile,
  viewedPaths,
  writeLayout,
  writeViewed,
} from '../state/pull-diff.state'
import { pullAbilities, toPull, toPullCommit, toPullEvent } from '../state/pull.state'
import type { ServerPull, ServerRepoDiff } from '../types/pull.types'

const TABS: Record<string, PullTab> = {
  pull: 'overview',
  'pull-commits': 'commits',
  'pull-checks': 'checks',
  'pull-files': 'files',
}

const { target, permissions, frozen, reloadBranches } = inject(repoKey)!
const me = inject(sessionKey)!.user
const route = useRoute()
const number = computed(() => Number(route.params.number))
const tab = computed(() => TABS[String(route.name)] ?? 'overview')
const basePath = computed(() => repoPath(target.value, `pulls/${number.value}`))
const viewedKey = computed(() => `${target.value.owner}/${target.value.name}#${number.value}`)

const server = ref<ServerPull | null>(null)
const pull = computed(() => (server.value ? toPull(server.value) : null))
const events = ref<PullEvent[] | null>(null)
const commits = ref<PullCommit[] | null>(null)
const diff = ref<ServerRepoDiff | null>(null)
const files = computed(() => diff.value?.files.map(toDiffFile))
const viewed = ref<string[]>([])
const layout = ref<DiffLayout>(readLayout())
const filter = ref('')
const method = ref<PullMergeMethod>('allow')
const page = useAction()
const filesAction = useAction()
const expand = useAction()
const merge = useAction()
const manage = useAction()
const ready = useAction()
const titleAction = useAction()
const bodyAction = useAction()
const comment = useAction()
const draft = ref('')
const actions = [page, filesAction, expand, merge, manage, ready, titleAction, bodyAction, comment]
const abilities = computed(() =>
  pullAbilities(permissions.value, me.value, server.value?.author.user, frozen.value),
)

let seq = 0
type Action = ReturnType<typeof useAction>

// A result or failure that arrives after the page moved to another pull is dropped.
function forPull(action: Action, run: (stale: () => boolean) => Promise<void>) {
  const mine = seq
  const stale = () => mine !== seq
  return action.attempt(async () => {
    try {
      await run(stale)
    } catch (e) {
      if (!stale()) throw e
    }
  })
}

const loadPull = () =>
  forPull(page, async (stale) => {
    const p = await getPull(target.value, number.value)
    if (!stale()) server.value = p
  })

async function loadEvents(stale: () => boolean) {
  const t = target.value
  const n = number.value
  const out: PullEvent[] = []
  let after: string | undefined
  for (;;) {
    const batch = await pullEvents(t, n, after)
    out.push(...batch.map(toPullEvent))
    if (batch.length < 100) break
    after = batch.at(-1)!.id
  }
  if (!stale()) events.value = out
}

async function loadTab() {
  const t = target.value
  const n = number.value
  if (tab.value === 'overview' && !events.value) await forPull(page, loadEvents)
  if (tab.value === 'commits' && !commits.value)
    await forPull(page, async (stale) => {
      const list = (await pullCommits(t, n)).map(toPullCommit)
      if (!stale()) commits.value = list
    })
  if (tab.value === 'files' && !diff.value)
    await forPull(filesAction, async (stale) => {
      const d = await pullDiff(t, n)
      if (stale()) return
      diff.value = d
      viewed.value = viewedPaths(readViewed(viewedKey.value), d.files)
    })
}

watch(
  [target, number],
  async () => {
    seq++
    server.value = null
    events.value = null
    commits.value = null
    diff.value = null
    viewed.value = []
    filter.value = ''
    method.value = 'allow'
    draft.value = ''
    for (const a of actions) a.error.value = ''
    await loadPull()
    if (server.value) await loadTab()
  },
  { immediate: true },
)
watch(tab, () => {
  if (server.value) void loadTab()
})
watch(layout, writeLayout)

// Everything the page shows may have moved after a state change.
async function refresh(p: ServerPull) {
  server.value = p
  events.value = null
  commits.value = null
  diff.value = null
  await loadTab()
}

const onMerge = (m: PullMergeMethod) =>
  forPull(merge, async (stale) => {
    const p = server.value!
    try {
      const merged = await mergePull(target.value, number.value, {
        fast_forward: m,
        expect_target: p.base_commit,
        expect_head: p.head_commit,
      })
      if (stale()) return
      await refresh(merged)
      void reloadBranches?.()
    } catch (e) {
      // The page reloads so the locks, conflicts or moved branches behind the refusal show.
      if (!stale() && e instanceof ApiError && e.status === 409) await loadPull()
      throw e
    }
  })

const onState = (action: typeof closePull) => {
  if (manage.busy.value) return
  return forPull(manage, async (stale) => {
    const p = await action(target.value, number.value)
    if (!stale()) await refresh(p)
  })
}

const markReady = () =>
  forPull(ready, async (stale) => {
    const p = await updatePull(target.value, number.value, { draft: false })
    if (!stale()) server.value = p
  })

// The page's editors close when the saved value comes back on the pull request.
const save = (action: Action, change: { title: string } | { body: string }) =>
  forPull(action, async (stale) => {
    const p = await updatePull(target.value, number.value, change)
    if (!stale()) server.value = p
  })

async function postComment(body: string, stale: () => boolean) {
  const event = await commentPull(target.value, number.value, { body })
  if (stale()) return
  draft.value = ''
  if (events.value) events.value = [...events.value, toPullEvent(event)]
  if (server.value) server.value = { ...server.value, comments: server.value.comments + 1 }
}

const onComment = (body: string) => forPull(comment, (stale) => postComment(body, stale))

// The comment is posted first, so a refused comment leaves the pull request open.
const closeWithComment = (body: string) =>
  forPull(comment, async (stale) => {
    if (body.trim()) await postComment(body, stale)
    if (stale()) return
    const p = await closePull(target.value, number.value)
    if (!stale()) await refresh(p)
  })

function setViewed(paths: string[]) {
  viewed.value = paths
  if (diff.value) writeViewed(viewedKey.value, paths, diff.value.files)
}

async function onExpand(e: DiffExpand) {
  const d = diff.value
  const file = d?.files.find((f) => f.path === e.path)
  const range = file && expandRange(file, e)
  if (!d || !file || !range) return
  await forPull(expand, async () => {
    const got = await fileLines(target.value, file.path, d.head_commit, range.start, range.end)
    if (diff.value !== d) return
    const next = applyExpand(file, e, got.start, got.lines)
    diff.value = { ...d, files: d.files.map((f) => (f === file ? next : f)) }
  })
}

const pageError = computed(() => page.error.value || undefined)
</script>

<template>
  <PynViewError v-if="!pull && pageError">{{ pageError }}</PynViewError>
  <PynLoading v-else-if="!pull" variant="block" />
  <template v-else>
    <PynViewError v-if="pageError">{{ pageError }}</PynViewError>
    <PynViewError v-if="manage.error.value">{{ manage.error.value }}</PynViewError>
    <PynViewError v-if="tab === 'files' && expand.error.value">{{
      expand.error.value
    }}</PynViewError>
    <PynViewNotice v-if="tab === 'files' && diff?.truncated" tone="warning">
      More files changed than this page lists.
    </PynViewNotice>
    <PynPullRequestPage
      v-model:method="method"
      v-model:layout="layout"
      v-model:filter="filter"
      :pull="pull"
      :tab="tab"
      :base-path="basePath"
      :owner="target.owner"
      :name="target.name"
      :me="me || undefined"
      :commits="commits ?? []"
      :events="events ?? []"
      :files="files ?? []"
      :viewed="viewed"
      :files-loading="tab === 'files' && !diff && !filesAction.error.value"
      :files-error="filesAction.error.value || undefined"
      :editable="abilities.canManage"
      :title-saving="titleAction.busy.value"
      :title-error="titleAction.error.value || undefined"
      :body-saving="bodyAction.busy.value"
      :body-error="bodyAction.error.value || undefined"
      :can-merge="abilities.canMerge"
      :can-mark-ready="abilities.canManage"
      :can-override-locks="abilities.canOverrideLocks"
      :can-manage="abilities.canManage"
      :merging="merge.busy.value || ready.busy.value"
      :merge-error="merge.error.value || ready.error.value || undefined"
      @merge="onMerge"
      @ready="markReady"
      @edit-title="titleAction.error.value = ''"
      @save-title="(title) => save(titleAction, { title })"
      @save-body="(body) => save(bodyAction, { body })"
      @close="onState(closePull)"
      @reopen="onState(reopenPull)"
      @expand="onExpand"
      @update:viewed="setViewed"
    >
      <template #notices>
        <PynViewNotice v-if="pull.draft && pull.state === 'open'" tone="info" title="Draft">
          This pull request is a draft and cannot be merged until it is marked ready for review.
        </PynViewNotice>
      </template>
      <template v-if="abilities.canComment" #comment>
        <PynCommentForm
          v-model="draft"
          :busy="comment.busy.value || manage.busy.value"
          :error="comment.error.value || undefined"
          :can-close="abilities.canManage && pull.state === 'open'"
          @submit="onComment"
          @close="closeWithComment"
        />
      </template>
    </PynPullRequestPage>
  </template>
</template>
