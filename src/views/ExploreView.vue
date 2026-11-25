<script setup lang="ts">
import {
  PynButton,
  PynRepoList,
  PynSignInPrompt,
  PynViewHeader,
  PynViewNotice,
} from '@avalon-initiative/pyn-common-ui'
import { computed, onMounted } from 'vue'
import { useExplore } from '../state/explore.state'
import { repoRows } from '../state/repo.state'

const { repos, next, loaded, busy, error, refused, load, more } = useExplore()

const rows = computed(() => repoRows(repos.value))

onMounted(load)
</script>

<template>
  <PynViewHeader title="Explore" />
  <PynSignInPrompt v-if="refused" message="Sign in to browse this server." sign-in-href="/" />
  <PynViewNotice v-else-if="error" tone="warning">{{ error }}</PynViewNotice>
  <template v-else-if="loaded">
    <PynRepoList :repos="rows" empty="No public repositories yet." />
    <PynButton v-if="next" label="Show more" variant="secondary" :disabled="busy" @click="more" />
  </template>
</template>
