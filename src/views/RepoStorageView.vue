<script setup lang="ts">
import { computed, inject } from 'vue'
import { repoKey, sessionKey } from '../state/context.state'
import { canOpenSettings, canSeeStorage, isRepoOwner } from '../state/repo-access.state'
import RepoStorageSection from './RepoStorageSection.vue'

const { target, permissions, org } = inject(repoKey)!
const { user, admin } = inject(sessionKey)!
const isOwner = computed(() => isRepoOwner(target.value.owner, user.value, org.value))
</script>

<template>
  <RepoStorageSection
    v-if="
      canOpenSettings(permissions, isOwner, admin) && canSeeStorage(permissions, isOwner, admin)
    "
    :owner="isOwner"
  />
</template>
