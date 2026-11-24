<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchHistory } from '../api/repos'
import { useAction } from '../state/action.state'
import { useBranch } from '../state/branch.state'
import { repoKey } from '../state/context.state'
import type { Revision } from '@avalon-initiative/pyn-common-ui'
import { PynHistory, historyQuery, repoPath } from '@avalon-initiative/pyn-common-ui'

const { target, branches, branchesLoading, branchesError, selectBranch } = inject(repoKey)!
const route = useRoute()
const router = useRouter()
const branch = useBranch()
// The picker shows only for a named branch, so the default branch is named too.
const shownBranch = computed(() => branch.value ?? branches?.value.find((b) => b.isDefault)?.name)
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
    :branch="shownBranch"
    :branches="branches"
    :branches-loading="branchesLoading"
    :branches-error="branchesError || undefined"
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
  />
</template>
