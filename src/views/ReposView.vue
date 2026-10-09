<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listRepos } from '../api/repos'
import PynRepoList from '../components/PynRepoList.vue'
import { useAction } from '../state/action.state'
import { sortRepos } from '../state/repo.state'
import styles from '../styles/View.module.scss'
import type { RepoInfo } from '../types/repo.types'

const repos = ref<RepoInfo[]>([])
const loaded = ref(false)
const { error, attempt } = useAction()

onMounted(async () => {
  await attempt(async () => {
    repos.value = sortRepos(await listRepos())
  })
  loaded.value = true
})
</script>

<template>
  <header :class="styles.header">
    <h1 :class="styles.title">Repositories</h1>
    <span :class="styles.actions">
      <a href="/_/locks" :class="styles.secondary">Your active locks</a>
      <a href="/_/new" :class="styles.action">New repository</a>
    </span>
  </header>
  <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
  <PynRepoList v-else-if="loaded" :repos="repos" />
</template>
