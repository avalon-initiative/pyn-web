<script setup lang="ts">
import { inject } from 'vue'
import { useRouter } from 'vue-router'
import { createRepo } from '../api/repos'
import PynRepoForm from '../components/PynRepoForm.vue'
import { useAction } from '../state/action.state'
import { sessionKey } from '../state/context.state'
import { repoPath } from '../state/repo.state'
import styles from '../styles/View.module.scss'
import type { RepoSettings } from '../types/repo.types'

const user = inject(sessionKey)!.user
const router = useRouter()
const { busy, error, attempt } = useAction()

const create = (settings: RepoSettings) =>
  attempt(async () => {
    const repo = await createRepo(user.value, settings)
    await router.push(repoPath(repo))
  })
</script>

<template>
  <header :class="styles.header">
    <h1 :class="styles.title">New repository</h1>
  </header>
  <PynRepoForm :owner="user" :busy="busy" :error="error" @submit="create" />
</template>
