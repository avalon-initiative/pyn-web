<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchHistory } from '../api/repos'
import PynHistory from '../components/PynHistory.vue'
import { useAction } from '../state/action.state'
import { repoKey } from '../state/context.state'
import { historyQuery } from '../state/history.state'
import type { Revision } from '../types/repo.types'

const { target } = inject(repoKey)!
const route = useRoute()
const router = useRouter()
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
  await router.replace({ query: historyQuery(nextPath, nextFilter) })
  await load()
}

onMounted(() => load())
</script>

<template>
  <PynHistory
    :revisions="revisions"
    :filter="filter"
    :path="path"
    :has-more="cursor !== null"
    :loading="loading"
    :busy="busy"
    :error="error"
    @filter="apply('', $event)"
    @clear-path="apply('', '')"
    @more="load(true)"
  />
</template>
