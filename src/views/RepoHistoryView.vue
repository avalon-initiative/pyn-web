<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fileHistory } from '../api/repos'
import PynHistory from '../components/PynHistory.vue'
import { useAction } from '../state/action.state'
import { repoKey } from '../state/context.state'
import type { Revision } from '../types/repo.types'

const { target } = inject(repoKey)!
const route = useRoute()
const router = useRouter()
const path = ref(String(route.query.path ?? ''))
const revisions = ref<Revision[]>([])
const { busy, error, attempt } = useAction()

const load = () =>
  attempt(async () => {
    revisions.value = path.value ? await fileHistory(target.value, path.value) : []
  })

async function search(next: string) {
  path.value = next
  await router.replace({ query: next ? { path: next } : {} })
  await load()
}

onMounted(load)
</script>

<template>
  <PynHistory :path="path" :revisions="revisions" :busy="busy" :error="error" @search="search" />
</template>
