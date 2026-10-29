<script setup lang="ts">
import {
  PynRepoDelete,
  PynRepoForm,
  type RepoSettings,
  repoPath,
  repoSlug,
  PynViewStack,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { deleteRepo, updateRepo } from '../api/repos'
import { useAction } from '../state/action.state'
import { repoKey, sessionKey } from '../state/context.state'
import { EDIT_POLICY } from '../state/policy.state'
import { canOpenSettings, isRepoOwner } from '../state/repo-access.state'
import RepoPolicyView from './RepoPolicyView.vue'

const { repo, target, reload, permissions, org, frozen } = inject(repoKey)!
const user = inject(sessionKey)!.user
const router = useRouter()
const saving = useAction()
const removing = useAction()
const canEditPolicy = computed(() => permissions.value.includes(EDIT_POLICY))
const isOwner = computed(() => isRepoOwner(target.value.owner, user.value, org.value))

watchEffect(() => {
  if (repo.value && !canOpenSettings(permissions.value, isOwner.value))
    router.replace(repoPath(target.value))
})

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
  <PynViewStack v-if="repo && canOpenSettings(permissions, isOwner)">
    <PynRepoForm
      v-if="isOwner"
      :key="repo.id"
      :owner="repo.owner"
      :repo="repo"
      :effective-max-locks="repo.max_locks_per_user"
      :readonly="frozen"
      :busy="saving.busy.value"
      :error="saving.error.value"
      @submit="save"
    />
    <RepoPolicyView v-if="canEditPolicy" :key="repo.id" />
    <PynRepoDelete
      v-if="isOwner"
      :slug="repoSlug(repo)"
      :readonly="frozen"
      :busy="removing.busy.value"
      :error="removing.error.value"
      @remove="remove"
    />
  </PynViewStack>
</template>
