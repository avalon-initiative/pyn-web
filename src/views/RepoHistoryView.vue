<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createBranch, fetchHistory } from '../api/repos'
import { useAction } from '../state/action.state'
import { useBranch } from '../state/branch.state'
import { useBranchDialog } from '../state/branch-dialog.state'
import { repoKey } from '../state/context.state'
import { canWrite } from '../state/freeze.state'
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
const revisions = ref<Revision[]>([])
const cursor = ref<string | null>(null)
const { busy, error, attempt } = useAction()
const loading = ref(true)
let seq = 0

async function load(more = false) {
  const mine = ++seq
  const ok = await attempt(async () => {
    const page = await fetchHistory(target.value, {
      path: path.value,
      branch: branch.value,
      filter: filter.value,
      before: more ? cursor.value : null,
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

async function apply(nextPath: string, nextFilter: string) {
  path.value = nextPath
  filter.value = nextFilter
  loading.value = true
  await router.replace({ query: { ...historyQuery(nextPath, nextFilter), branch: branch.value } })
  await load()
}

watch(branch, () => {
  loading.value = true
  load()
})

onMounted(() => load())
</script>

<template>
  <PynHistory
    title="History"
    :revisions="revisions"
    :branch="branch"
    :branches="branches"
    :branches-loading="branchesLoading"
    :branches-error="branchesError || undefined"
    :new-branch-button="creatable"
    :branches-href="branches?.length ? repoPath(target, 'branches') : undefined"
    :filter="filter"
    :path="path"
    :has-more="cursor !== null"
    :loading="loading"
    :busy="busy"
    :error="error"
    @filter="apply('', $event)"
    @clear-path="apply('', '')"
    @more="load(true)"
    @select-branch="selectBranch?.($event)"
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
