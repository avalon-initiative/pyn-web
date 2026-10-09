<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '../api/client'
import { fetchSummary, fetchTree } from '../api/repos'
import PynRepoLanding from '../components/PynRepoLanding.vue'
import { useAction } from '../state/action.state'
import { repoKey, sessionKey } from '../state/context.state'
import { folderParam } from '../state/tree.state'
import styles from '../styles/View.module.scss'
import type { RepoSummary, TreeListing } from '../types/tree.types'

const { target, repo } = inject(repoKey)!
const user = inject(sessionKey)!.user
const route = useRoute()
const path = computed(() => folderParam(route.params.path))
const listing = ref<TreeListing | null>(null)
const summary = ref<RepoSummary | null>(null)
const missing = ref(false)
const now = ref(new Date())
const { error, attempt } = useAction()
let timer: ReturnType<typeof setInterval> | undefined

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
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'path_not_found')) throw e
      listing.value = null
      missing.value = true
      summary.value = await fetchSummary(target.value)
    }
  })
}

watch(path, () => {
  listing.value = null
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
    :missing="missing"
    :me="user"
    :now="now"
  />
</template>
