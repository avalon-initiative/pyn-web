<script setup lang="ts">
import {
  PynRepoForm,
  type RepoSettings,
  repoPath,
  ownerChoices,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listMyOrgs } from '../api/orgs'
import { createRepo } from '../api/repos'
import { useAction } from '../state/action.state'
import { sessionKey } from '../state/context.state'
import styles from '../styles/View.module.scss'
import type { OrgInfo } from '../types/org.types'

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
    await router.push(repoPath(repo))
  })
</script>

<template>
  <header :class="styles.header">
    <h1 :class="styles.title">New repository</h1>
  </header>
  <PynRepoForm
    :owner="owner"
    :owners="owners"
    :busy="busy"
    :error="error"
    @update:owner="chosen = $event"
    @submit="create"
  />
</template>
