<script setup lang="ts">
import {
  PynRepoList,
  PynViewAction,
  PynViewError,
  PynViewHeader,
} from '@avalon-initiative/pyn-common-ui'
import { onMounted, ref } from 'vue'
import { listRepos } from '../api/repos'
import { useAction } from '../state/action.state'
import { sortRepos } from '../state/repo.state'
import type { RepoInfo } from '@avalon-initiative/pyn-common-ui'

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
  <PynViewHeader title="Repositories">
    <PynViewAction href="/_/locks">Your active locks</PynViewAction>
    <PynViewAction href="/_/new" primary>New repository</PynViewAction>
  </PynViewHeader>
  <PynViewError v-if="error">{{ error }}</PynViewError>
  <PynRepoList v-else-if="loaded" :repos="repos" />
</template>
