<script setup lang="ts">
import { computed, inject, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '../api/client'
import { getRepo, repoMe } from '../api/repos'
import PynRepoHeader from '../components/PynRepoHeader.vue'
import PynRepoNotFound from '../components/PynRepoNotFound.vue'
import { useAction } from '../state/action.state'
import { repoKey, sessionKey } from '../state/context.state'
import { repoTabs } from '../state/repo.state'
import styles from '../styles/View.module.scss'
import type { RepoInfo } from '../types/repo.types'

const route = useRoute()
const user = inject(sessionKey)!.user
const owner = computed(() => String(route.params.owner))
const name = computed(() => String(route.params.name))
const section = computed(() => {
  const s = String(route.path.split('/')[3] ?? '')
  return s === 'tree' ? '' : s
})

const target = computed(() => ({ owner: owner.value, name: name.value }))
const repo = ref<RepoInfo | null>(null)
const permissions = ref<string[]>([])
const notFound = ref(false)
const { error, attempt } = useAction()

async function load() {
  const t = target.value
  notFound.value = false
  return attempt(async () => {
    try {
      const [info, me] = await Promise.all([getRepo(t), repoMe(t)])
      repo.value = info
      permissions.value = me.permissions
    } catch (e) {
      if (e instanceof ApiError && e.code === 'repo_not_found') notFound.value = true
      else throw e
    }
  })
}

watch(
  target,
  () => {
    repo.value = null
    load()
  },
  { immediate: true },
)

provide(repoKey, {
  target,
  repo,
  permissions,
  reload: async () => void (await load()),
})

const tabs = computed(() => repoTabs(permissions.value, owner.value === user.value))
</script>

<template>
  <PynRepoNotFound v-if="notFound" :slug="`${owner}/${name}`" />
  <p v-else-if="error" :class="styles.error" role="alert">{{ error }}</p>
  <template v-else-if="repo">
    <PynRepoHeader
      :owner="repo.owner"
      :name="repo.name"
      :visibility="repo.visibility"
      :lease-hours="repo.lease_hours"
      :role="repo.role"
      :tabs="permissions.includes('read') ? tabs : undefined"
      :current="section"
    />
    <p v-if="!permissions.includes('read')" :class="styles.summary">
      You have no role in this repository. Ask an admin to add you or send an invitation.
    </p>
    <RouterView v-else />
  </template>
</template>
