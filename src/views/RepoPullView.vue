<script setup lang="ts">
import {
  PynButton,
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
const abilities = computed(() =>
  pullAbilities(permissions.value, me.value, server.value?.author.user, frozen.value),
)

async function loadPull() {
  const t = target.value
  const n = number.value
  await page.attempt(async () => {
    const p = await getPull(t, n)
    if (t === target.value && n === number.value) server.value = p
  })
}

async function loadEvents() {
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
  if (t === target.value && n === number.value) events.value = out
}

async function loadTab() {
  const t = target.value
  const n = number.value
  if (tab.value === 'overview' && !events.value) await page.attempt(loadEvents)
  if (tab.value === 'commits' && !commits.value)
    await page.attempt(async () => {
      const list = (await pullCommits(t, n)).map(toPullCommit)
      if (t === target.value && n === number.value) commits.value = list
    })
  if (tab.value === 'files' && !diff.value)
    await filesAction.attempt(async () => {
      const d = await pullDiff(t, n)
      if (t !== target.value || n !== number.value) return
      diff.value = d
      viewed.value = viewedPaths(readViewed(viewedKey.value), d.files)
    })
}

watch(
  [target, number],
  async () => {
    server.value = null
    events.value = null
    commits.value = null
    diff.value = null
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
  merge.attempt(async () => {
    const p = server.value!
    try {
      await refresh(
        await mergePull(target.value, number.value, {
          fast_forward: m,
          expect_target: p.base_commit,
          expect_head: p.head_commit,
        }),
      )
      void reloadBranches?.()
    } catch (e) {
      // The page reloads so the locks, conflicts or moved branches behind the refusal show.
      if (e instanceof ApiError && e.status === 409) await loadPull()
      throw e
    }
  })

const onState = (action: typeof closePull) =>
  manage.attempt(async () => refresh(await action(target.value, number.value)))

const markReady = () =>
  manage.attempt(async () => {
    server.value = await updatePull(target.value, number.value, { draft: false })
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
  await expand.attempt(async () => {
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
    <PynViewNotice v-if="server?.draft && pull.state === 'open'" tone="info" title="Draft">
      This pull request is a draft and cannot be merged until it is marked ready for review.
      <PynButton
        v-if="abilities.canManage"
        label="Ready for review"
        variant="secondary"
        :disabled="manage.busy.value"
        data-ready
        @click="markReady"
      />
    </PynViewNotice>
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
      :can-merge="abilities.canMerge && !server?.draft"
      :can-manage="abilities.canManage"
      :merging="merge.busy.value"
      :merge-error="merge.error.value || undefined"
      @merge="onMerge"
      @close="onState(closePull)"
      @reopen="onState(reopenPull)"
      @expand="onExpand"
      @update:viewed="setViewed"
    />
  </template>
</template>
