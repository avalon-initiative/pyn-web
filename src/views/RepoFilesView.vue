<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '../api/client'
import { fetchContent, fetchSummary, fetchTree } from '../api/repos'
import { useAction } from '../state/action.state'
import { paletteKey, repoKey, sessionKey } from '../state/context.state'
import { useBranch } from '../state/branch.state'
import { useHashScroll } from '../state/hash.state'
import {
  fileBody,
  folderParam,
  repoPath,
  readmeEntry,
  VIEW_LIMIT,
  type ReadmeDoc,
  type RepoSummary,
  type TreeEntry,
  type TreeListing,
  PynViewError,
  PynBranchCompare,
  PynRepoLanding,
} from '@avalon-initiative/pyn-common-ui'

const {
  target,
  repo,
  permissions,
  locks,
  branches,
  branchesLoading,
  branchesError,
  selectBranch,
  tags,
  tagsLoading,
  tagsError,
  tagsHref,
  compare,
  starCount,
  watcherCount,
} = inject(repoKey)!
const user = inject(sessionKey)!.user
const palette = inject(paletteKey, null)
const route = useRoute()
const origin = window.location.origin
const slug = computed(() => `${target.value.owner}/${target.value.name}`)
const path = computed(() => folderParam(route.params.path))
const branch = useBranch()
const listing = ref<TreeListing | null>(null)
const summary = ref<RepoSummary | null>(null)
// The branch bar names summary.default_branch (on a branch, that branch).
const barSummary = computed(() =>
  summary.value
    ? {
        ...summary.value,
        ...(branch.value ? { default_branch: branch.value } : {}),
      }
    : null,
)
const missing = ref(false)
const isEmpty = computed(
  () =>
    !!listing.value &&
    !path.value &&
    !branch.value &&
    listing.value.entries.every((e) => e.name === '.pyn'),
)
// The policy file alone is not content: the landing shows the quick setup.
const shown = computed(() =>
  listing.value && isEmpty.value ? { ...listing.value, entries: [] } : listing.value,
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
      locks.value = sum.locks
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
  <PynRepoLanding
    v-if="repo"
    :repo="repo"
    :path="path"
    :branch="branch"
    :listing="shown"
    :summary="barSummary"
    :branches="branches"
    hide-rail-branches
    :branches-href="branches?.length ? repoPath(target, 'branches') : undefined"
    :branch-count="branches?.length"
    :branches-loading="branchesLoading"
    :branches-error="branchesError || undefined"
    :tags="tags"
    :tags-loading="tagsLoading"
    :tags-error="tagsError || undefined"
    :tags-href="tagsHref"
    :tag-count="tagsLoading || tagsError ? undefined : tags?.length"
    :https-url="permissions.includes('read') ? `${origin}/${slug}` : undefined"
    :clone-command="`pyn clone ${slug}`"
    :readme="readme"
    :missing="missing"
    :me="user"
    :now="now"
    :about="{ stars: starCount, watching: watcherCount }"
    go-to-file
    @select="(name, kind) => selectBranch?.(name, kind)"
    @go-to-file="palette?.show()"
  >
    <template v-if="compare?.show.value" #compare>
      <PynBranchCompare v-bind="compare.props.value" @select="compare.open" />
    </template>
  </PynRepoLanding>
</template>
