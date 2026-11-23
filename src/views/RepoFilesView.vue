<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '../api/client'
import { fetchContent, fetchSummary, fetchTree } from '../api/repos'
import { useAction } from '../state/action.state'
import { repoKey, sessionKey } from '../state/context.state'
import { useBranch } from '../state/branch.state'
import { firstCommitSteps } from '../state/empty.state'
import { useHashScroll } from '../state/hash.state'
import {
  fileBody,
  folderParam,
  readmeEntry,
  VIEW_LIMIT,
  type ReadmeDoc,
  type RepoSummary,
  type TreeEntry,
  type TreeListing,
  PynEmptyState,
  PynViewError,
  PynRepoLanding,
} from '@avalon-initiative/pyn-common-ui'

const { target, repo } = inject(repoKey)!
const user = inject(sessionKey)!.user
const route = useRoute()
const path = computed(() => folderParam(route.params.path))
const branch = useBranch()
const listing = ref<TreeListing | null>(null)
const summary = ref<RepoSummary | null>(null)
// The branch bar names summary.default_branch; on a branch it names that branch instead.
const barSummary = computed(() =>
  summary.value && branch.value
    ? { ...summary.value, default_branch: branch.value }
    : summary.value,
)
const missing = ref(false)
const isEmpty = computed(
  () =>
    !!listing.value &&
    !path.value &&
    !branch.value &&
    listing.value.entries.every((e) => e.name === '.pyn'),
)
const steps = computed(() =>
  repo.value
    ? firstCommitSteps(window.location.origin, user.value, `${repo.value.owner}/${repo.value.name}`)
    : '',
)
const readme = ref<ReadmeDoc | null>(null)
const now = ref(new Date())
const { error, attempt } = useAction()
let readmeRevision: number | null = null
let timer: ReturnType<typeof setInterval> | undefined

/** Reloads the README only when its revision changed; one that is not text shows nothing. */
async function loadReadme(entries: TreeEntry[], p: string) {
  const b = branch.value
  const found = readmeEntry(entries)
  const revision = found?.last_change?.id ?? null
  if (!found || revision === null) {
    readme.value = null
    readmeRevision = null
    return
  }
  if (revision === readmeRevision) return
  const body = fileBody(
    found.path,
    await fetchContent(target.value, found.path, VIEW_LIMIT, undefined, b),
  )
  if (p !== path.value || b !== branch.value) return
  readme.value =
    body.kind === 'markdown' || body.kind === 'code'
      ? { name: found.name, path: found.path, text: body.text }
      : null
  readmeRevision = revision
}

async function refresh() {
  now.value = new Date()
  const p = path.value
  const b = branch.value
  await attempt(async () => {
    try {
      const [tree, sum] = await Promise.all([
        fetchTree(target.value, p, b),
        fetchSummary(target.value, undefined, b),
      ])
      if (p !== path.value || b !== branch.value) return
      listing.value = tree
      summary.value = sum
      missing.value = false
      await loadReadme(tree.entries, p)
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'path_not_found')) throw e
      listing.value = null
      readme.value = null
      readmeRevision = null
      missing.value = true
      summary.value = await fetchSummary(target.value, undefined, b)
    }
  })
}

watch([path, branch], () => {
  listing.value = null
  readme.value = null
  readmeRevision = null
  refresh()
})

useHashScroll(() => readme.value)

onMounted(() => {
  refresh()
  timer = setInterval(refresh, 15_000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <PynViewError v-if="error">{{ error }}</PynViewError>
  <PynEmptyState
    v-if="repo && isEmpty"
    title="This repository only has its policy file so far"
    :description="steps"
  />
  <PynRepoLanding
    v-if="repo && !isEmpty"
    :repo="repo"
    :path="path"
    :branch="branch"
    :listing="listing"
    :summary="barSummary"
    :readme="readme"
    :missing="missing"
    :me="user"
    :now="now"
  />
</template>
