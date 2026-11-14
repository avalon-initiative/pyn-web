<script setup lang="ts">
import {
  PynRepoSettings,
  repoPath,
  repoSettingsNav,
  repoSettingsPath,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { repoKey, sessionKey } from '../state/context.state'
import { isRepoOwner } from '../state/repo-access.state'

const { target, permissions, org } = inject(repoKey)!
const { user, admin } = inject(sessionKey)!
const route = useRoute()
const router = useRouter()
const isOwner = computed(() => isRepoOwner(target.value.owner, user.value, org.value))
const items = computed(() =>
  repoSettingsNav(permissions.value, isOwner.value, { serverAdmin: admin.value }),
)
const current = computed(() => route.path.split('/')[4] || 'settings')

watchEffect(() => {
  if (current.value !== 'settings' || items.value.some((i) => i.section === 'settings')) return
  const first = items.value[0]
  router.replace(first ? repoSettingsPath(target.value, first.section) : repoPath(target.value))
})
</script>

<template>
  <PynRepoSettings :owner="target.owner" :name="target.name" :items="items" :current="current">
    <RouterView />
  </PynRepoSettings>
</template>
