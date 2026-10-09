<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '../api/client'
import { fetchContent, fetchSummary, fetchTree } from '../api/repos'
import PynRepoLanding from '../components/PynRepoLanding.vue'
import { useAction } from '../state/action.state'
import { fileBody, readmeEntry, VIEW_LIMIT } from '../state/blob.state'
import { repoKey, sessionKey } from '../state/context.state'
import { folderParam } from '../state/tree.state'
import styles from '../styles/View.module.scss'
import type { ReadmeDoc } from '../types/blob.types'
import type { RepoSummary, TreeEntry, TreeListing } from '../types/tree.types'

const { target, repo } = inject(repoKey)!
const user = inject(sessionKey)!.user
const route = useRoute()
const path = computed(() => folderParam(route.params.path))
const listing = ref<TreeListing | null>(null)
const summary = ref<RepoSummary | null>(null)
const missing = ref(false)
const readme = ref<ReadmeDoc | null>(null)
const now = ref(new Date())
const { error, attempt } = useAction()
let readmeRevision: number | null = null
let timer: ReturnType<typeof setInterval> | undefined

/** Reloads the README only when its revision changed; one that is not text shows nothing. */
async function loadReadme(entries: TreeEntry[], p: string) {
  const found = readmeEntry(entries)
  const revision = found?.last_change?.id ?? null
  if (!found || revision === null) {
    readme.value = null
    readmeRevision = null
    return
  }
  if (revision === readmeRevision) return
  const body = fileBody(found.path, await fetchContent(target.value, found.path, VIEW_LIMIT))
  if (p !== path.value) return
  readme.value =
    body.kind === 'markdown' || body.kind === 'code'
      ? { name: found.name, path: found.path, text: body.text }
      : null
  readmeRevision = revision
}

async function refresh() {
  now.value = new Date()
  const p = path.value
  await attempt(async () => {
    try {
      const [tree, sum] = await Promise.all([
        fetchTree(target.value, p),
        fetchSummary(target.value),
      ])
      if (p !== path.value) return
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
      summary.value = await fetchSummary(target.value)
    }
  })
}

watch(path, () => {
  listing.value = null
  readme.value = null
  readmeRevision = null
  refresh()
})

onMounted(() => {
  refresh()
  timer = setInterval(refresh, 15_000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
  <PynRepoLanding
    v-if="repo"
    :repo="repo"
    :path="path"
    :listing="listing"
    :summary="summary"
    :readme="readme"
    :missing="missing"
    :me="user"
    :now="now"
  />
</template>
