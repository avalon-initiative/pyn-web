<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createBranch, fetchHistory, historyAuthors } from '../api/repos'
import { useAction } from '../state/action.state'
import { useBranch } from '../state/branch.state'
import { useBranchDialog } from '../state/branch-dialog.state'
import { repoKey } from '../state/context.state'
import { canWrite } from '../state/freeze.state'
import {
  asRange,
  authorOptions,
  filterQuery,
  rangeSince,
  type HistoryRange,
} from '../state/history-filters.state'
import type { Revision } from '@avalon-initiative/pyn-common-ui'
import {
  PynBranchDialog,
  PynHistory,
  historyQuery,
  repoPath,
} from '@avalon-initiative/pyn-common-ui'

const {
  target,
  permissions,
  frozen,
  branches,
  branchesLoading,
  branchesError,
  selectBranch,
  reloadBranches,
  tags,
  tagsLoading,
  tagsError,
  tagsHref,
} = inject(repoKey)!
const route = useRoute()
const router = useRouter()
const branch = useBranch()
const creatable = computed(() => canWrite(permissions.value.includes('checkin'), frozen.value))
const dialog = useBranchDialog({
  create: async (name, from) => {
    await createBranch(target.value, name, from)
    await reloadBranches?.()
    await selectBranch?.(name)
  },
})
const path = ref(String(route.query.path ?? ''))
const filter = ref(path.value ? '' : String(route.query.filter ?? ''))
const author = ref(path.value ? '' : String(route.query.author ?? ''))
const range = ref<HistoryRange>(path.value ? 'all' : asRange(route.query.range))
const authors = ref<string[] | null>(null)
const revisions = ref<Revision[]>([])
const cursor = ref<string | null>(null)
const { busy, error, attempt } = useAction()
const loading = ref(true)
let seq = 0
// Fixed per first page so later pages share the same window.
let since: string | undefined

async function load(more = false) {
  const mine = ++seq
  if (!more) since = rangeSince(range.value)
  const ok = await attempt(async () => {
    const page = await fetchHistory(target.value, {
      path: path.value,
      branch: branch.value,
      filter: filter.value,
      before: more ? cursor.value : null,
      ...(path.value ? {} : { author: author.value, since }),
    })
    if (mine !== seq) return
    revisions.value = more ? [...revisions.value, ...page.revisions] : page.revisions
    cursor.value = page.next_cursor
  })
  if (mine !== seq) return
  if (!ok && !more) {
    revisions.value = []
    cursor.value = null
  }
  loading.value = false
}

// The author list is a convenience: without it the user filter is hidden.
async function loadAuthors() {
  const on = branch.value
  try {
    const list = (await historyAuthors(target.value, on)).authors
    if (on === branch.value) authors.value = list
  } catch {
    if (on === branch.value) authors.value = null
  }
}

async function apply(
  nextPath: string,
  nextFilter: string,
  nextAuthor = author.value,
  nextRange = range.value,
) {
  path.value = nextPath
  filter.value = nextFilter
  author.value = nextAuthor
  range.value = nextRange
  loading.value = true
  await router.replace({
    query: {
      ...historyQuery(nextPath, nextFilter),
      ...(nextPath ? {} : filterQuery(nextAuthor, nextRange)),
      branch: branch.value,
    },
  })
  await load()
}

const users = computed(() =>
  path.value || !authors.value ? undefined : authorOptions(authors.value, author.value),
)

watch(branch, () => {
  loading.value = true
  load()
  loadAuthors()
})

onMounted(() => {
  load()
  loadAuthors()
})
</script>

<template>
  <PynHistory
    title="History"
    :revisions="revisions"
    :branch="branch"
    :branches="branches"
    :branches-loading="branchesLoading"
    :branches-error="branchesError || undefined"
    :tags="tags"
    :tags-loading="tagsLoading"
    :tags-error="tagsError || undefined"
    :tags-href="tagsHref"
    :new-branch-button="creatable"
    :branches-href="branches?.length ? repoPath(target, 'branches') : undefined"
    :filter="filter"
    :path="path"
    :users="users"
    :user="author"
    :range="path ? undefined : range"
    :has-more="cursor !== null"
    :loading="loading"
    :busy="busy"
    :error="error"
    @filter="apply('', $event)"
    @clear-path="apply('', '')"
    @select-user="apply('', filter, $event)"
    @select-range="apply('', filter, author, $event)"
    @more="load(true)"
    @select-branch="(name, kind) => selectBranch?.(name, kind)"
    @new-branch="dialog.openCreate(branch)"
  />
  <PynBranchDialog
    :open="dialog.open.value"
    mode="create"
    :from="dialog.from.value"
    :branches="branches ?? []"
    :busy="dialog.busy.value"
    :error="dialog.error.value || undefined"
    @close="dialog.close"
    @create="dialog.create"
  />
</template>
