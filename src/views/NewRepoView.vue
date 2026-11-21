<script setup lang="ts">
import {
  PynRepoForm,
  type RepoSettings,
  repoPath,
  ownerChoices,
  PynViewHeader,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listMyOrgs } from '../api/orgs'
import { createRepo } from '../api/repos'
import { refreshRepos } from '../state/session-data.state'
import { useAction } from '../state/action.state'
import { sessionKey } from '../state/context.state'
import type { OrgInfo } from '@avalon-initiative/pyn-common-ui'

const user = inject(sessionKey)!.user
const router = useRouter()
const { busy, error, attempt } = useAction()
const orgs = ref<OrgInfo[]>([])
const chosen = ref('')
const owners = computed(() => ownerChoices(user.value, orgs.value))
const owner = computed(() => chosen.value || user.value)

onMounted(() =>
  listMyOrgs().then(
    (o) => (orgs.value = o),
    () => undefined,
  ),
)

const create = (settings: RepoSettings) =>
  attempt(async () => {
    const repo = await createRepo(owner.value, settings)
    void refreshRepos()
    await router.push(repoPath(repo))
  })
</script>

<template>
  <PynViewHeader title="New repository" />
  <PynRepoForm
    :owner="owner"
    :owners="owners"
    :busy="busy"
    :error="error"
    @update:owner="chosen = $event"
    @submit="create"
  />
</template>
