<script setup lang="ts">
import { PynViewHeader, PynWatchedRepos, repoSlug } from '@avalon-initiative/pyn-common-ui'
import type { RepoRef, WatchLevel } from '@avalon-initiative/pyn-common-ui'
import { computed, onMounted, ref } from 'vue'
import { deleteWatch, listWatching, putWatch } from '../api/repos'
import { useAction } from '../state/action.state'
import { watchedItems, withLevel } from '../state/watching.state'
import type { WatchedRepo } from '../types/repo.types'

const list = ref<WatchedRepo[]>([])
const loaded = ref(false)
const pending = ref<string | null>(null)
const { error, attempt } = useAction()
const rows = computed(() => watchedItems(list.value, pending.value))

async function change(repo: RepoRef, call: () => Promise<{ level: WatchLevel | null }>) {
  if (pending.value) return
  pending.value = repoSlug(repo)
  await attempt(async () => {
    list.value = withLevel(list.value, repo, (await call()).level)
  })
  pending.value = null
}

onMounted(async () => {
  await attempt(async () => {
    list.value = await listWatching()
  })
  loaded.value = true
})
</script>

<template>
  <PynViewHeader title="Watching" />
  <PynWatchedRepos
    :repos="rows"
    :loading="!loaded"
    :error="error || undefined"
    @level="(repo, level) => change(repo, () => putWatch(repo, level))"
    @unwatch="(repo) => change(repo, () => deleteWatch(repo))"
  />
</template>
