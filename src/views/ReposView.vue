<script setup lang="ts">
import {
  PynEmptyState,
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
  <template v-else-if="loaded">
    <PynRepoList v-if="repos.length" :repos="repos" />
    <PynEmptyState
      v-else
      title="You are not in any repository yet"
      description="Repositories you create or are invited to show up here."
      primary-label="Create a repository"
      primary-href="/_/new"
    />
  </template>
</template>
