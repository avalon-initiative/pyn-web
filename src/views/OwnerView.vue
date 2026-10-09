<script setup lang="ts">
import { inject, ref, watch } from 'vue'
import { listRepos } from '../api/repos'
import PynRepoList from '../components/PynRepoList.vue'
import { useAction } from '../state/action.state'
import { orgKey } from '../state/context.state'
import { sortRepos } from '../state/repo.state'
import styles from '../styles/View.module.scss'
import type { RepoInfo } from '../types/repo.types'

const { name, org } = inject(orgKey)!
const repos = ref<RepoInfo[]>([])
const loaded = ref(false)
const { error, attempt } = useAction()

watch(
  name,
  async () => {
    loaded.value = false
    await attempt(async () => {
      repos.value = sortRepos(await listRepos(name.value))
    })
    loaded.value = true
  },
  { immediate: true },
)
</script>

<template>
  <header v-if="!org" :class="styles.header">
    <h1 :class="styles.title">{{ name }}</h1>
  </header>
  <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
  <PynRepoList
    v-else-if="loaded"
    :repos="repos"
    :empty="`${name} has no repositories you can see.`"
  />
</template>
