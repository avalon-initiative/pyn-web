<script setup lang="ts">
import { inject } from 'vue'
import { useRouter } from 'vue-router'
import { deleteRepo, updateRepo } from '../api/repos'
import PynRepoDelete from '../components/PynRepoDelete.vue'
import PynRepoForm from '../components/PynRepoForm.vue'
import { useAction } from '../state/action.state'
import { repoKey } from '../state/context.state'
import { repoPath, repoSlug } from '../state/repo.state'
import styles from '../styles/View.module.scss'
import type { RepoSettings } from '../types/repo.types'

const { repo, target, reload } = inject(repoKey)!
const router = useRouter()
const saving = useAction()
const removing = useAction()

const save = (s: RepoSettings) =>
  saving.attempt(async () => {
    const updated = await updateRepo(target.value, s)
    if (updated.name !== target.value.name) await router.replace(repoPath(updated, 'settings'))
    else await reload()
  })

const remove = () =>
  removing.attempt(async () => {
    await deleteRepo(target.value)
    await router.push('/')
  })
</script>

<template>
  <div v-if="repo" :class="styles.stack">
    <PynRepoForm
      :key="repoSlug(repo)"
      :owner="repo.owner"
      :repo="repo"
      :busy="saving.busy.value"
      :error="saving.error.value"
      @submit="save"
    />
    <PynRepoDelete
      :slug="repoSlug(repo)"
      :busy="removing.busy.value"
      :error="removing.error.value"
      @remove="remove"
    />
  </div>
</template>
