<script setup lang="ts">
import { PynRepoList, PynViewError } from '@avalon-initiative/pyn-common-ui'
import { inject, ref, watch } from 'vue'
import { listRepos } from '../api/repos'
import { useAction } from '../state/action.state'
import { orgKey } from '../state/context.state'
import { sortRepos } from '../state/repo.state'
import type { RepoInfo } from '@avalon-initiative/pyn-common-ui'

const { name } = inject(orgKey)!
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
  <PynViewError v-if="error">{{ error }}</PynViewError>
  <PynRepoList
    v-else-if="loaded"
    :repos="repos"
    :empty="`${name} has no repositories you can see.`"
  />
</template>
